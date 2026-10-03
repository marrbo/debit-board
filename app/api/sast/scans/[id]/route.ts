// app/api/sast/scans/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SASTScan } from "@/models/SASTScan";
import { SASTScanResult } from "@/models/SASTScanResult";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

interface EnrichedPattern {
  patternId: string;
  /** Identificador estável do Debit-Board, ex.: "DB-INJ-001". */
  dbId: string | null;
  /** Slug kebab-case em inglês, ex.: "sql-injection-csharp-concatenation". */
  dbName: string | null;
  name: string | null;
  query: string | null;
  category: string;
  severity: string;
  slaHours: number;
  hitCount: number;
  error: string | null;
  score: number | null;
  externalId: string | null;
  externalLink: string | null;
}

/**
 * Detalhe de um scan SAST do tenant do usuário autenticado.
 *
 * `result.patterns` é enriquecido com metadados do pattern (`name`,
 * `score`, `externalId`, `externalLink`). O campo `query` só é
 * devolvido para admin — para os demais, `null` (inteligência do
 * pattern restrita).
 *
 * `result` pode ser `null` quando o scan não chegou a persistir
 * `SASTScanResult` (ex.: falha antes da gravação final).
 *
 * @summary Detalhe de um scan SAST
 * @tags Sast, Scans
 * @route GET /api/sast/scans/{id}
 * @async
 * @function GET
 * @param {NextRequest} _req - Requisição HTTP (não utilizada).
 * @param {RouteContext} context - Parâmetros da rota (`id`).
 * @returns {Promise<NextResponse>} `{ scan, result, isAdmin }`.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const isAdmin = auth.roles.includes("admin");

  await connectToDatabase();

  const { id } = await context.params;
  const scanId = toObjectId(id);
  if (!scanId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const tenantId = toObjectId(auth.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant inválido." }, { status: 400 });
  }

  const scan = await SASTScan.findOne({ _id: scanId, tenantId }).lean();
  if (!scan) {
    return NextResponse.json(
      { error: "Scan não encontrado." },
      { status: 404 },
    );
  }

  const rawResult = await SASTScanResult.findOne({ scanId, tenantId }).lean();

  let result: {
    totalOccurrences: number;
    failedPatterns: number;
    patterns: EnrichedPattern[];
  } | null = null;

  if (rawResult) {
    const patternIds = rawResult.patterns.map((p) => p.patternId);

    const patterns = await VulnerabilityPattern.find({
      _id: { $in: patternIds },
    })
      .select({
        _id: 1,
        dbId: 1,
        dbName: 1,
        name: 1,
        score: 1,
        externalId: 1,
        externalLink: 1,
        externalIdCWE: 1,
        externalLinkCWE: 1,
      })
      .lean();

    const byId = new Map(patterns.map((p) => [String(p._id), p]));

    result = {
      totalOccurrences: rawResult.totalOccurrences,
      failedPatterns: rawResult.failedPatterns,
      patterns: rawResult.patterns.map((p) => {
        const pid = String(p.patternId);
        const meta = byId.get(pid);
        const errorRaw = p.error ?? null;

        return {
          patternId: pid,
          dbId: meta?.dbId ?? null,
          dbName: meta?.dbName ?? null,
          name: meta?.name ?? null,
          query: isAdmin ? p.query : null,
          category: p.category,
          severity: p.severity,
          slaHours: p.slaHours,
          hitCount: p.hitCount,
          error: isAdmin
            ? errorRaw
            : errorRaw
              ? "Falha na execução do pattern"
              : null,
          score: meta?.score ?? null,
          externalId: meta?.externalId ?? null,
          externalLink: meta?.externalLink ?? null,
        };
      }),
    };
  }

  // `scan` já traz `riskScore` e `riskBand` do banco (lean).
  // Expor como bloco `risk` para simetria com o response do /run.
  const risk = {
    score: (scan as { riskScore?: number }).riskScore ?? 0,
    band: (scan as { riskBand?: string }).riskBand ?? "minimal",
  };

  return NextResponse.json({ scan, result, isAdmin, risk });
}
