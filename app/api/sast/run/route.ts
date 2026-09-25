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

// ============================================================
// ROTA PRINCIPAL
// ============================================================
/**
 * Executa o SAST Scanner sobre os patterns selecionados.
 *
 * Sem `profileId` no corpo (ou `null`), executa todos os patterns ativos
 * — comportamento "Default".
 *
 * @summary Executa SAST Scanner
 * @tags Sast, Run
 * @route POST /api/sast/run
 * @async
 * @function POST
 * @param {NextRequest} req - Corpo opcional: `{ profileId?: string | null }`.
 * @returns {Promise<NextResponse>} Resultado do scan (scanId, ocorrências, patterns, falhas).
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
    const rawProfileId: unknown = body?.profileId;
    const profileId = typeof rawProfileId === "string" ? rawProfileId : null;

    // ============================================================
    // SELEÇÃO DE PATTERNS (perfil ou Default = todos)
    // ============================================================
    let patternFilter: Record<string, unknown> = { enabled: true };
    let profileName: string | null = null;

    if (profileId) {
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

      patternFilter = { _id: { $in: profile.patternIds }, enabled: true };
      profileName = profile.name;
    }

    const settings = tenant.azureSettings;
    const ignoreTls = settings.ignoreTlsErrors || false;
    const tenantId = tenant._id.toString();

    const patterns = await VulnerabilityPattern.find(patternFilter).lean();
    if (!patterns.length) {
      return NextResponse.json(
        { error: "Nenhum pattern SAST ativo para este perfil." },
        { status: 400 },
      );
    }

    const newScan = new SASTScan({
      tenantId,
      scanDate: new Date(),
      status: "running",
      patternCount: 0,
      totalOccurrences: 0,
      failedPatterns: 0,
      summary: [],
    });
    await newScan.save();

    // ================== PROCESSAMENTO ==================
    try {
      const existingObservations = await Observation.find({ tenantId }).lean();
      const observationMap = new Map<string, any>();
      existingObservations.forEach((observation) => {
        const key = `${observation.project || ""}|${observation.repository || ""}|${observation.filePath}|${observation.category}`;
        observationMap.set(key, observation);
      });

      const foundKeys = new Set<string>();
      const patternResults = [];
      let totalOccurrences = 0;
      let failedPatterns = 0;
      const newObservations: any[] = [];
      const updates: any[] = [];

      for (const pattern of patterns) {
        try {
          const result = await executeSearch(
            pattern.queryPattern,
            settings,
            ignoreTls,
            tenantId,
          );

          if (result.error) {
            patternResults.push({
              patternId: pattern._id.toString(),
              query: pattern.queryPattern,
              category: pattern.category,
              severity: pattern.severity,
              slaHours: pattern.slaHours,
              results: [],
              hitCount: 0,
              error: result.error,
            });
            failedPatterns++;
            continue;
          }

          result.results = result.results.filter(
            (item: SearchItem) =>
              ["main", "master"].includes(item.branch) &&
              !isExcludedPath(item.path),
          );

          patternResults.push({
            patternId: pattern._id.toString(),
            query: pattern.queryPattern,
            category: pattern.category,
            severity: pattern.severity,
            slaHours: pattern.slaHours,
            results: result.results,
            hitCount: result.results.length,
          });

          totalOccurrences += result.results.length;

          for (const item of result.results) {
            const key = `${pattern.category}|${item.patternId}|${item.project || ""}|${item.repository || ""}|${item.path}|${item.fileName}`;
            if (foundKeys.has(key)) continue;
            foundKeys.add(key);

            const existingIssue = observationMap.get(key);
            if (existingIssue) {
              let nextStatus = existingIssue.status;
              if (existingIssue.status === "resolved") {
                nextStatus = "recurring";
              }

              updates.push({
                updateOne: {
                  filter: { _id: existingIssue._id },
                  update: {
                    $set: {
                      status: nextStatus,
                      lastSeen: new Date(),
                      hitCount: item.hitCount || 0,
                      patternId: pattern._id.toString(),
                      hits: item.hits,
                      scanId: newScan._id,
                      project: item.project || "",
                      repository: item.repository || "",
                    },
                  },
                },
              });
            } else {
              const now = new Date();
              const slaDueAt = new Date(
                now.getTime() + (pattern.slaHours || 72) * 3600 * 1000,
              );

              newObservations.push({
                tenantId,
                scanId: newScan._id,
                patternId: pattern._id.toString(),
                query: pattern.queryPattern,
                category: pattern.category,
                severity: pattern.severity,
                slaHours: pattern.slaHours,
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
                slaDueAt: slaDueAt,
                snippet: null,
                lineNumber: 0,
              });
              observationMap.set(key, { _id: "temp", status: "open" });
            }
          }
        } catch (searchErr: any) {
          console.error(
            `Erro ao buscar padrão ${pattern.name}:`,
            searchErr.message,
          );
          patternResults.push({
            patternId: pattern._id.toString(),
            query: pattern.queryPattern,
            category: pattern.category,
            severity: pattern.severity,
            slaHours: pattern.slaHours,
            results: [],
            hitCount: 0,
            error: searchErr.message,
          });
          failedPatterns++;
        }
      }

      const resolvedUpdates: any[] = [];
      observationMap.forEach((issue, key) => {
        if (!foundKeys.has(key) && issue._id !== "temp") {
          let nextStatus = "resolved";
          if (isExcludedPath(issue.filePath) && issue.status !== "exclusion") {
            nextStatus = "exclusion";
          } else if (issue.status !== "resolved") {
            nextStatus = "resolved";
          }

          if (issue.status !== nextStatus) {
            resolvedUpdates.push({
              updateOne: {
                filter: { _id: issue._id },
                update: {
                  $set: {
                    status: nextStatus,
                    lastSeen: new Date(),
                  },
                },
              },
            });
          }
        }
      });

      if (newObservations.length > 0)
        await Observation.insertMany(newObservations);
      if (updates.length > 0) await Observation.bulkWrite(updates);
      if (resolvedUpdates.length > 0)
        await Observation.bulkWrite(resolvedUpdates);

      await SASTScanResult.create({
        scanId: newScan._id,
        tenantId,
        patterns: patternResults,
        totalOccurrences,
        failedPatterns,
      });

      await SASTScan.findByIdAndUpdate(newScan._id, {
        $set: {
          status: "completed",
          totalOccurrences,
          patternCount: patternResults.length,
          failedPatterns,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        scanId: newScan._id,
        profileName,
        totalOccurrences,
        patternCount: patternResults.length,
        failedPatterns,
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
