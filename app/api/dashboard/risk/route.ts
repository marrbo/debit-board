// app/api/dashboard/risk/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import {
  aggregateRisk,
  type RiskFinding,
  type RiskSeverity,
  type RiskStatus,
} from "@/lib/risk";

/**
 * Score de risco consolidado do tenant (0–100) + quebra por
 * severidade e top categorias. Alimenta o card de risco do dashboard.
 *
 * Considera todos os findings **ativos** (qualquer status ≠ resolved).
 *
 * @summary Risco consolidado do tenant
 * @tags Dashboard, Risk
 * @route GET /api/dashboard/risk
 * @async
 * @function GET
 */
export async function GET() {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant inválido." }, { status: 400 });
  }

  await connectToDatabase();

  const observations = await Observation.find({ tenantId })
    .select({
      severity: 1,
      status: 1,
      hitCount: 1,
      firstSeen: 1,
      slaDueAt: 1,
      category: 1,
    })
    .lean();

  const findings: RiskFinding[] = observations.map((o) => ({
    severity: o.severity as RiskSeverity,
    status: o.status as RiskStatus,
    hitCount: o.hitCount ?? 0,
    firstSeen: o.firstSeen,
    slaDueAt: o.slaDueAt,
  }));

  const risk = aggregateRisk(findings);

  // Top 5 categorias por contagem de findings ativos
  const byCategoryMap = new Map<
    string,
    { category: string; count: number; critical: number; high: number }
  >();
  for (const o of observations) {
    if (o.status === "resolved") continue;
    const key = o.category || "—";
    const row = byCategoryMap.get(key) ?? {
      category: key,
      count: 0,
      critical: 0,
      high: 0,
    };
    row.count += 1;
    if (o.severity === "critical") row.critical += 1;
    if (o.severity === "high") row.high += 1;
    byCategoryMap.set(key, row);
  }
  const byCategory = Array.from(byCategoryMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json({ risk, byCategory });
}
