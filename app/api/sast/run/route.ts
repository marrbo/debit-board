// app/api/sast/run/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { ScanProfile } from "@/models/ScanProfile";
import { SASTScan } from "@/models/SASTScan";
import { SASTScanResult } from "@/models/SASTScanResult";
import { Observation } from "@/models/Observation";
import { executeSearch } from "@/lib/azureSearch";
import mongoose from "mongoose";
import type { SearchItem } from "@/lib/types";
import type { IScanProfile } from "@/types/IScanProfile";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { aggregateRisk, type RiskFinding, type RiskSeverity } from "@/lib/risk";
import {
  recordScanEvents,
  type ScanEventSource,
} from "@/lib/observation-events";

// ============================================================
// CONSTANTES DE EXCLUSÃO
// ============================================================
const EXCLUDED_DIRS = [
  "node_modules",
  "bin",
  "obj",
  "dist",
  "build",
  ".git",
  "__pycache__",
  "venv",
  "vendor",
  ".next",
  ".nuxt",
  "coverage",
  ".gradle",
  ".idea",
  ".vscode",
  "target",
  "tmp",
  "temp",
  "logs",
  "log",
  "packages",
  "files",
  "uploads",
  "bower_components",
  ".cache",
  "public/assets",
];

const EXCLUDED_FILE_EXTENSIONS = [
  ".min.js",
  ".min.css",
  ".map",
  ".lock",
  ".bundle.js",
  ".bundle.min.js",
  ".minified.js",
  ".minified.css",
];

// ============================================================
// PARALELISMO
// ============================================================
const SEARCH_CONCURRENCY = 8;

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active--;
    const next = queue.shift();
    if (next && active < concurrency) next();
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        Promise.resolve()
          .then(() => fn())
          .then(
            (value) => {
              resolve(value);
              release();
            },
            (error) => {
              reject(error);
              release();
            },
          );
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
}

function isExcludedPath(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const parts = normalized.split("/");
  if (parts.some((part) => EXCLUDED_DIRS.includes(part))) return true;
  const lowerPath = normalized.toLowerCase();
  if (EXCLUDED_FILE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext)))
    return true;
  return false;
}

function observationKey(
  patternId: string,
  project: string,
  repository: string,
  filePath: string,
): string {
  return `${patternId}|${project}|${repository}|${filePath}`;
}

/**
 * Sobrevivente em empate de duplicatas: prefere status ativo (`open`);
 * em caso de mesmo status, prefere `firstSeen` mais antigo. Preserva
 * histórico (a observação original), descarta a duplicata tardia.
 */
function pickSurvivor(current: any, challenger: any): boolean {
  const currentActive = current.status === "open";
  const challengerActive = challenger.status === "open";
  if (currentActive !== challengerActive) return currentActive;
  return (
    new Date(current.firstSeen).getTime() <=
    new Date(challenger.firstSeen).getTime()
  );
}

interface PatternFetchOutcome {
  patternIdStr: string;
  query: string;
  category: string;
  severity: string;
  slaHours: number;
  name: string;
  results: SearchItem[] | null;
  error: string | null;
}

/**
 * Executa o SAST Scanner sobre os patterns selecionados.
 *
 * Modos de seleção (ordem de prioridade):
 *   1. `patternIds` → lista explícita de patterns.
 *   2. `rerunOfScanId` + `mode` → reexecuta a partir de um scan anterior.
 *      - `mode: "failed"` → apenas patterns que falharam.
 *      - `mode: "full"`   → todos os patterns do scan (default).
 *   3. `profileId` → patterns do perfil escolhido.
 *   4. Nenhum → todos os patterns ativos (Default).
 *
 * @summary Executa SAST Scanner
 * @tags Sast, Run
 * @route POST /api/sast/run
 * @async
 * @function POST
 * @param {NextRequest} req - Corpo:
 *   `{ patternIds?: string[], rerunOfScanId?: string, mode?: "full" | "failed", profileId?: string | null }`.
 * @returns {Promise<NextResponse>} Resultado do scan.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    await connectToDatabase();
    const dbUser = await User.findOne({ sub: auth.user.sub });

    let tenant = null;
    const tenantIdCandidate = dbUser?.tenantId;

    if (
      !tenant &&
      tenantIdCandidate &&
      mongoose.Types.ObjectId.isValid(tenantIdCandidate)
    ) {
      tenant = await Tenant.findById(tenantIdCandidate);
    }

    if (!tenant || !tenant.azureSettings) {
      return NextResponse.json(
        { error: "Azure settings not configured." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));

    const rawPatternIds: unknown = body?.patternIds;
    const explicitPatternIds: string[] | null =
      Array.isArray(rawPatternIds) &&
      rawPatternIds.length > 0 &&
      rawPatternIds.every((id) => typeof id === "string" && id.length > 0)
        ? (rawPatternIds as string[])
        : null;

    const rawRerunOfScanId: unknown = body?.rerunOfScanId;
    const rerunOfScanId =
      typeof rawRerunOfScanId === "string" ? rawRerunOfScanId : null;

    const rawMode: unknown = body?.mode;
    const mode: "full" | "failed" = rawMode === "failed" ? "failed" : "full";

    const rawProfileId: unknown = body?.profileId;
    const profileId = typeof rawProfileId === "string" ? rawProfileId : null;

    // ============================================================
    // SELEÇÃO DE PATTERNS
    // Prioridade: patternIds > rerunOfScanId > profileId > todos.
    // ============================================================
    let patternFilter: Record<string, unknown> = {
      enabled: true,
      deprecated: { $ne: true },
    };
    let profileName: string | null = null;
    let requestedPatternIds: string[] | null = null;
    let selectionSource: "explicit" | "rerun" | "profile" | "default" =
      "default";

    if (explicitPatternIds) {
      requestedPatternIds = explicitPatternIds;
      patternFilter = {
        _id: { $in: explicitPatternIds },
        enabled: true,
        deprecated: { $ne: true },
      };
      selectionSource = "explicit";
    } else if (rerunOfScanId) {
      const scanObjId = toObjectId(rerunOfScanId);
      if (!scanObjId) {
        return NextResponse.json(
          { error: "rerunOfScanId inválido." },
          { status: 400 },
        );
      }

      const priorResult = await SASTScanResult.findOne({
        scanId: scanObjId,
        tenantId: tenant._id,
      }).lean();

      if (!priorResult) {
        return NextResponse.json(
          { error: "Resultado do scan anterior não encontrado." },
          { status: 404 },
        );
      }

      requestedPatternIds = priorResult.patterns
        .filter((p) => (mode === "failed" ? Boolean(p.error) : true))
        .map((p) => p.patternId.toString());

      if (requestedPatternIds.length === 0) {
        return NextResponse.json(
          {
            error:
              mode === "failed"
                ? "Nenhum pattern com falha no scan anterior."
                : "Scan anterior não possui patterns registrados.",
          },
          { status: 400 },
        );
      }

      patternFilter = {
        _id: { $in: requestedPatternIds },
        enabled: true,
        deprecated: { $ne: true },
      };
      selectionSource = "rerun";
    } else if (profileId) {
      const profileObjectId = toObjectId(profileId);
      if (!profileObjectId) {
        return NextResponse.json(
          { error: "Perfil inválido." },
          { status: 400 },
        );
      }

      const profile = await ScanProfile.findOne({
        _id: profileObjectId,
        sub: auth.user.sub,
      }).lean<IScanProfile>();

      if (!profile) {
        return NextResponse.json(
          { error: "Perfil não encontrado." },
          { status: 404 },
        );
      }

      requestedPatternIds = profile.patternIds.map((id) => id.toString());
      patternFilter = {
        _id: { $in: profile.patternIds },
        enabled: true,
        deprecated: { $ne: true },
      };
      profileName = profile.name;
      selectionSource = "profile";
    }

    const settings = tenant.azureSettings;
    const ignoreTls = settings.ignoreTlsErrors || false;
    const tenantId = tenant._id.toString();

    const patterns = await VulnerabilityPattern.find(patternFilter).lean();
    if (!patterns.length) {
      return NextResponse.json(
        {
          error:
            requestedPatternIds !== null
              ? "Nenhum pattern ativo correspondente à seleção."
              : "Nenhum pattern SAST ativo.",
        },
        { status: 400 },
      );
    }

    const skippedDisabledCount = requestedPatternIds
      ? requestedPatternIds.length - patterns.length
      : 0;

    const activePatternIds = patterns.map((p) => p._id.toString());

    const newScan = new SASTScan({
      tenantId,
      origin: "azure-search-code", // fixo enquanto só há um motor
      scanDate: new Date(),
      status: "running",
      patternCount: 0,
      totalOccurrences: 0,
      failedPatterns: 0,
      summary: [],
      profileId: profileId ? toObjectId(profileId) : undefined,
      profileName: profileName ?? undefined,
      rerunOfScanId: rerunOfScanId ? toObjectId(rerunOfScanId) : undefined,
    });
    await newScan.save();

    // ================== PROCESSAMENTO ==================
    try {
      const existingObservations = await Observation.find({
        tenantId,
        patternId: { $in: activePatternIds },
      }).lean();

      const observationMap = new Map<string, any>();
      // Duplicatas pré-existentes — resolvidas em bloco no fim do scan.
      // `observationMap` mantém apenas a sobrevivente por chave.
      const duplicateIds: string[] = [];

      for (const observation of existingObservations) {
        if (!observation.patternId) continue;
        const key = observationKey(
          observation.patternId.toString(),
          observation.project || "",
          observation.repository || "",
          observation.filePath || "",
        );

        const current = observationMap.get(key);
        if (!current) {
          observationMap.set(key, observation);
          continue;
        }

        if (pickSurvivor(current, observation)) {
          duplicateIds.push(String(observation._id));
        } else {
          duplicateIds.push(String(current._id));
          observationMap.set(key, observation);
        }
      }

      // ========================================================
      // FASE 1 — Fetch paralelo com concorrência limitada.
      // ========================================================
      const limit = createLimiter(SEARCH_CONCURRENCY);

      const fetchOutcomes: PatternFetchOutcome[] = await Promise.all(
        patterns.map((pattern) =>
          limit(async (): Promise<PatternFetchOutcome> => {
            const patternIdStr = pattern._id.toString();
            const base: Omit<PatternFetchOutcome, "results" | "error"> = {
              patternIdStr,
              query: pattern.queryPattern,
              category: pattern.category,
              severity: pattern.severity,
              slaHours: pattern.slaHours,
              name: pattern.name,
            };

            try {
              const response = await executeSearch(
                pattern.queryPattern,
                settings,
                ignoreTls,
                tenantId,
              );

              if (response.error) {
                return { ...base, results: null, error: response.error };
              }

              const filtered = response.results.filter(
                (item: SearchItem) =>
                  ["main", "master"].includes(item.branch) &&
                  !isExcludedPath(item.path),
              );

              return { ...base, results: filtered, error: null };
            } catch (err: any) {
              return {
                ...base,
                results: null,
                error: err?.message || String(err),
              };
            }
          }),
        ),
      );

      // ========================================================
      // FASE 2 — Processamento serial.
      // ========================================================
      const foundKeys = new Set<string>();
      const patternResults = [];
      let totalOccurrences = 0;
      let failedPatterns = 0;
      const newObservations: any[] = [];
      const updates: any[] = [];
      const now = new Date();

      // Fontes de evento — resolvidas para ScanEventSource após os
      // bulkWrites, para já ter os `_id` definitivos de observations novas.
      const patternNameById = new Map(
        fetchOutcomes.map((o) => [o.patternIdStr, o.name]),
      );
      const detectedCandidates: Array<{ patternId: string; filePath: string }> =
        [];
      const reopenedSources: ScanEventSource[] = [];
      const resolvedSources: ScanEventSource[] = [];

      for (const outcome of fetchOutcomes) {
        const { patternIdStr, query, category, severity, slaHours } = outcome;

        if (outcome.error || !outcome.results) {
          console.error(
            `Erro ao buscar padrão ${patternIdStr}:`,
            outcome.error,
          );
          patternResults.push({
            patternId: patternIdStr,
            query,
            category,
            severity,
            slaHours,
            results: [],
            hitCount: 0,
            error: outcome.error,
          });
          failedPatterns++;
          continue;
        }

        const results = outcome.results;

        patternResults.push({
          patternId: patternIdStr,
          query,
          category,
          severity,
          slaHours,
          results,
          hitCount: results.length,
        });

        totalOccurrences += results.length;

        for (const item of results) {
          const key = observationKey(
            patternIdStr,
            item.project || "",
            item.repository || "",
            item.path,
          );
          if (foundKeys.has(key)) continue;
          foundKeys.add(key);

          const existingIssue = observationMap.get(key);
          if (existingIssue) {
            const wasResolved = existingIssue.status === "resolved";

            const setFields: Record<string, unknown> = {
              lastSeen: now,
              hitCount: item.hitCount || 0,
              patternId: patternIdStr,
              hits: item.hits,
              scanId: newScan._id,
              project: item.project || "",
              repository: item.repository || "",
            };

            const updateOp: Record<string, unknown> = { $set: setFields };

            if (wasResolved) {
              // Regressão: resolved → open. Histórico preservado em
              // `resolvedAt`/`resolvedReason` (última resolução que não
              // se sustentou); contador de ciclos incrementado.
              setFields.status = "open";
              setFields.reopenedAt = now;
              updateOp.$inc = { recurrenceCount: 1 };

              reopenedSources.push({
                type: "reopened",
                observationId: existingIssue._id,
                patternId: new mongoose.Types.ObjectId(patternIdStr),
                patternName: patternNameById.get(patternIdStr),
                filePath: item.path,
                reason: "regression",
              });
            }
            // `open` (sem mudança de status) e `wont_fix`/`expired`
            // (decisão do usuário preservada) só atualizam lastSeen/hits.

            updates.push({
              updateOne: {
                filter: { _id: existingIssue._id },
                update: updateOp,
              },
            });
          } else {
            const slaDueAt = new Date(
              now.getTime() + (slaHours || 72) * 3600 * 1000,
            );

            newObservations.push({
              tenantId,
              scanId: newScan._id,
              patternId: patternIdStr,
              query,
              category,
              severity,
              slaHours,
              fileName: item.fileName,
              filePath: item.path,
              project: item.project || "",
              repository: item.repository || "",
              branch: item.branch || "main",
              hitCount: item.hitCount || 0,
              hits: item.hits,
              status: "open",
              firstSeen: now,
              lastSeen: now,
              slaDueAt,
              snippet: null,
              lineNumber: 0,
            });

            detectedCandidates.push({
              patternId: patternIdStr,
              filePath: item.path,
            });
          }
        }
      }

      const resolvedUpdates: any[] = [];
      const resolvedNow = new Date();

      observationMap.forEach((issue, key) => {
        if (foundKeys.has(key)) return;
        // Preserva decisões do usuário — wont_fix e expired não são
        // sobrescritos pelo scan.
        if (issue.status === "resolved") return;
        if (issue.status === "wont_fix") return;
        if (issue.status === "expired") return;

        // `auto-resolved`: o pattern já foi resolvido e voltou a sumir
        // (recurrenceCount > 0) → o histórico prova que o padrão consegue
        // sumir e voltar, logo a ausência atual é confiável.
        // `scan-not-found`: primeira ausência; sem histórico prévio.
        const resolvedReason =
          (issue.recurrenceCount ?? 0) > 0 ? "auto-resolved" : "scan-not-found";

        resolvedSources.push({
          type: "resolved",
          observationId: issue._id,
          patternId: issue.patternId,
          patternName: patternNameById.get(issue.patternId.toString()),
          filePath: issue.filePath,
          reason: resolvedReason,
        });

        resolvedUpdates.push({
          updateOne: {
            filter: { _id: issue._id },
            update: {
              $set: {
                status: "resolved",
                resolvedAt: resolvedNow,
                resolvedReason,
              },
            },
          },
        });
      });

      // Duplicatas pré-existentes — resolvidas em bloco para que a UI
      // mostre apenas a observação canônica (sobrevivente).
      for (const dupId of duplicateIds) {
        resolvedUpdates.push({
          updateOne: {
            filter: { _id: dupId },
            update: {
              $set: {
                status: "resolved",
                resolvedAt: resolvedNow,
                resolvedReason: "duplicate-merged",
              },
            },
          },
        });
      }

      // `insertMany` retorna os docs na mesma ordem do input — index
      // alinhado com `detectedCandidates`.
      const insertedDetected =
        newObservations.length > 0
          ? await Observation.insertMany(newObservations)
          : [];
      if (updates.length > 0) await Observation.bulkWrite(updates);
      if (resolvedUpdates.length > 0)
        await Observation.bulkWrite(resolvedUpdates);

      const detectedSources: ScanEventSource[] = [];
      for (let i = 0; i < insertedDetected.length; i++) {
        const candidate = detectedCandidates[i];
        if (!candidate) continue;
        detectedSources.push({
          type: "detected",
          observationId: insertedDetected[i]._id,
          patternId: new mongoose.Types.ObjectId(candidate.patternId),
          patternName: patternNameById.get(candidate.patternId),
          filePath: candidate.filePath,
        });
      }

      await recordScanEvents({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        scanId: newScan._id,
        scanDisplayName: newScan.scanId ?? String(newScan._id),
        at: now,
        sources: [...detectedSources, ...reopenedSources, ...resolvedSources],
      });

      const riskFindings: RiskFinding[] = [];
      for (const outcome of fetchOutcomes) {
        if (!outcome.results) continue;
        for (const item of outcome.results) {
          riskFindings.push({
            severity: outcome.severity as RiskSeverity,
            // Recem-detectado: tratamos como `open` (o scan não conhece o
            // estado anterior de cada observation sem uma query extra).
            status: "open",
            hitCount: item.hitCount ?? 0,
          });
        }
      }
      const risk = aggregateRisk(riskFindings);

      await SASTScanResult.create({
        scanId: newScan._id,
        tenantId,
        patterns: patternResults,
        totalOccurrences,
        failedPatterns,
      });

      const completedAt = new Date();
      await SASTScan.findByIdAndUpdate(newScan._id, {
        $set: {
          status: "completed",
          totalOccurrences,
          patternCount: patternResults.length,
          failedPatterns,
          completedAt,
          durationMs: completedAt.getTime() - newScan.scanDate.getTime(),
          riskScore: risk.score,
          riskBand: risk.band,
        },
      });

      return NextResponse.json({
        success: true,
        scanId: newScan._id,
        profileName,
        rerunOfScanId: rerunOfScanId ?? null,
        mode: rerunOfScanId ? mode : null,
        selectionSource,
        skippedDisabled: skippedDisabledCount,
        totalOccurrences,
        patternCount: patternResults.length,
        failedPatterns,
        risk,
      });
    } catch (scanError: any) {
      console.error("Erro fatal no SAST:", scanError.message);
      await SASTScan.findByIdAndUpdate(newScan._id, {
        $set: {
          status: "failed",
          failedPatterns: 1,
          errorMessage: scanError.message,
          completedAt: new Date(),
        },
      });
      return NextResponse.json(
        {
          error: `Falha interna no servidor durante o SAST: ${scanError.message}`,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Erro fatal no SAST:", error.message);
    return NextResponse.json(
      { error: `Falha interna no servidor durante o SAST: ${error.message}` },
      { status: 500 },
    );
  }
}
