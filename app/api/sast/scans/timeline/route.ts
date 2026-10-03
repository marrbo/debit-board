// app/api/sast/scans/timeline/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SASTScan } from "@/models/SASTScan";
import { Observation } from "@/models/Observation";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";
import {
  aggregateRisk,
  type RiskFinding,
  type RiskSeverity,
  type RiskStatus,
} from "@/lib/risk";

interface TenantReferencePoint {
  _id: string;
  scanDate: Date;
  riskScore: number;
}

/**
 * Série temporal dos scans do tenant, ordenada cronologicamente.
 *
 * Query params:
 *   - `limit`  (default 30, máx 200)
 *   - `from` / `to` (ISO)
 *   - `teamId` — filtra por time e ativa `tenantReference`
 *   - `q`      — DBQL. Aplica o mesmo filtro de observations usado
 *                por `/api/dashboard` e `/api/dashboard/stats`. Quando
 *                presente, a série é recalculada a partir das
 *                observations (não usa `riskScore` armazenado).
 *
 * @summary Timeline de scans SAST
 * @tags Sast, Scans
 * @route GET /api/sast/scans/timeline
 * @async
 * @function GET
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant inválido." }, { status: 400 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") || "30", 10)),
  );
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dbqlId = searchParams.get("q");
  const rawTeamId = searchParams.get("teamId");
  const teamFilterActive = Boolean(rawTeamId && rawTeamId !== "all");
  const dbqlActive = Boolean(dbqlId && dbqlId.length > 0);

  const filter: Record<string, unknown> = {
    tenantId,
    status: "completed",
  };
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    filter.scanDate = range;
  }

  const scans = await SASTScan.find(filter)
    .sort({ scanDate: -1 })
    .limit(limit)
    .select({
      _id: 1,
      scanDate: 1,
      status: 1,
      totalOccurrences: 1,
      patternCount: 1,
      failedPatterns: 1,
      riskScore: 1,
      riskBand: 1,
    })
    .lean();

  // Fast path: sem filtro (DBQL nem time), usa o risco armazenado.
  if (!dbqlActive && !teamFilterActive) {
    return NextResponse.json({ scans: scans.reverse() });
  }

  // ============================================================
  // 1. Universo tenant-wide — já com DBQL aplicado
  // ============================================================
  const { match: tenantMatch } = await buildObservationFilters({
    tenantId,
    dbqlId,
  });

  // ============================================================
  // 2. Universo do time — mesma DBQL + restrição de time
  // ============================================================
  let teamProjectSet: Set<string> | null = null;
  if (teamFilterActive) {
    const { allowedProjectNames } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId: rawTeamId,
    });

    if (allowedProjectNames !== null) {
      if (allowedProjectNames.length === 0) {
        // Time existe mas não tem projetos vinculados → série vazia
        return NextResponse.json({ scans: [] });
      }
      teamProjectSet = new Set(allowedProjectNames);
    }
  }

  // ============================================================
  // 3. Uma query cobre os dois agrupamentos
  // ============================================================
  const scanIds = scans.map((s) => s._id);

  const observations = await Observation.find({
    ...tenantMatch,
    scanId: { $in: scanIds },
  })
    .select({
      scanId: 1,
      project: 1,
      severity: 1,
      status: 1,
      hitCount: 1,
      firstSeen: 1,
      slaDueAt: 1,
    })
    .lean();

  const teamFindingsByScan = new Map<string, RiskFinding[]>();
  const tenantFindingsByScan = new Map<string, RiskFinding[]>();

  for (const o of observations) {
    const scanKey = String(o.scanId);
    const finding: RiskFinding = {
      severity: o.severity as RiskSeverity,
      status: o.status as RiskStatus,
      hitCount: o.hitCount ?? 0,
      firstSeen: o.firstSeen,
      slaDueAt: o.slaDueAt,
    };

    const tenantArr = tenantFindingsByScan.get(scanKey) ?? [];
    tenantArr.push(finding);
    tenantFindingsByScan.set(scanKey, tenantArr);

    if (!teamProjectSet || (o.project && teamProjectSet.has(o.project))) {
      const teamArr = teamFindingsByScan.get(scanKey) ?? [];
      teamArr.push(finding);
      teamFindingsByScan.set(scanKey, teamArr);
    }
  }

  // ============================================================
  // 4. Alinhamento das duas séries por índice
  // ============================================================
  const aligned = scans.map((s) => {
    const key = String(s._id);
    const teamRisk = aggregateRisk(teamFindingsByScan.get(key) ?? []);
    const tenantRisk = aggregateRisk(tenantFindingsByScan.get(key) ?? []);

    return {
      scan: { ...s, riskScore: teamRisk.score, riskBand: teamRisk.band },
      tenantRef: {
        _id: s._id.toString(),
        scanDate: s.scanDate,
        riskScore: tenantRisk.score,
      } satisfies TenantReferencePoint,
    };
  });

  const response: {
    scans: unknown[];
    tenantReference?: TenantReferencePoint[];
  } = {
    scans: aligned.map((a) => a.scan).reverse(),
  };

  // Só expõe tenantReference quando há comparação útil (time selecionado)
  if (teamFilterActive) {
    response.tenantReference = aligned.map((a) => a.tenantRef).reverse();
  }

  return NextResponse.json(response);
}
