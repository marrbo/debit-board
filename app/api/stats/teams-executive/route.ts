// app/api/stats/teams-executive/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { Project } from "@/models/Project";
import { Team } from "@/models/Team";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";
import { normalizeProjectIds } from "@/lib/serverUtils";
import {
  aggregateRisk,
  type RiskAggregate,
  type RiskFinding,
  type RiskSeverity,
  type RiskStatus,
} from "@/lib/risk";
import type {
  CurrentStateAging,
  CurrentStateProjectRow,
  CurrentStateTotals,
  TeamCategoryRow,
  TeamCurrentState,
  TeamExecutiveEntry,
  TeamPatternRow,
  TeamSeverityTotals,
  TeamsExecutiveResponse,
} from "@/types/ITeamsExecutive";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOP_CATEGORIES = 10;
const TOP_PATTERNS = 10;
const TOP_EXPOSED_PROJECTS = 10;

// ============================================================
// Helpers de valores vazios
// ============================================================
const emptyTotals = (): TeamSeverityTotals => ({
  total: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  open: 0,
  resolved: 0,
  recurring: 0,
  wontFix: 0,
  expired: 0,
});

const emptyCurrentTotals = (): CurrentStateTotals => ({
  total: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  overdue: 0,
  atRisk: 0,
  onTrack: 0,
});

const emptyAging = (): CurrentStateAging => ({
  days0To30: 0,
  days31To60: 0,
  days61To90: 0,
  days90Plus: 0,
});

const emptyRisk = (): RiskAggregate => ({
  score: 0,
  band: "minimal",
  findings: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  topFindingRisk: 0,
});

const emptyCurrentState = (): TeamCurrentState => ({
  risk: emptyRisk(),
  totals: emptyCurrentTotals(),
  aging: emptyAging(),
  projects: [],
});

// ============================================================
// Tipos internos de facet
// ============================================================
interface ByProjectSevStatusRow {
  _id: { project: string; severity: string; status: string };
  count: number;
}

interface ByCategoryRow {
  _id: { project: string; category: string };
  observations: number;
  patterns: unknown[];
}

interface ByPatternRow {
  _id: { project: string; patternId: string; category: string };
  count: number;
}

interface CurrentRawRow {
  project: string | null;
  severity: string;
  status: string;
  hitCount: number;
  firstSeen: Date;
  slaDueAt: Date;
}

interface AgingRow {
  _id: { project: string; bucket: "0-30" | "31-60" | "61-90" | "90+" };
  count: number;
}

/**
 * Relatório executivo comparativo entre times.
 *
 * **Duas visões complementares**:
 *
 *  - **Fluxo** (`totals`, `categories`, `patterns`): respeita o
 *    range selecionado. Responde "o que apareceu no período?".
 *
 *  - **Estado atual** (`currentState`): **ignora o range**,
 *    restringe a `status:open | recurring` e mede o que existe
 *    agora — com **risk score** (0–100), SLA e aging. É o painel
 *    de exposição presente da indústria (OWASP SAMM VM-2, NIST
 *    SSDF PW.7, PCI-DSS 6.3.1, ISO 27001 A.8.8).
 *
 * Respeita DBQL + teamId + tenantId em ambas as visões.
 *
 * @summary Relatório executivo entre times
 * @tags Stats, Teams
 * @route GET /api/stats/teams-executive
 * @async
 * @function GET
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    const tenantId = toObjectId(auth.user.tenantId);
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const dbqlId = searchParams.get("q");
    const range = searchParams.get("range");
    const rangeFrom = searchParams.get("from");
    const rangeTo = searchParams.get("to");

    const { match: flowMatch } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId,
      range,
      rangeFrom,
      rangeTo,
    });

    const { match: lifetimeMatch } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId,
      range: "all",
    });

    const openMatch = {
      $and: [lifetimeMatch, { status: { $in: ["open", "recurring"] } }],
    };

    const scope: "global" | "team" =
      !teamId || teamId === "all" ? "global" : "team";

    // ============================================================
    // 1. Times + projetos
    // ============================================================
    const teamFilter =
      scope === "team"
        ? { _id: { $eq: toObjectId(teamId) } }
        : { isGlobal: { $ne: true } };

    const teams = await Team.find(teamFilter)
      .select("_id name projectIds")
      .sort({ name: 1 })
      .lean();

    if (teams.length === 0) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        scope,
        teams: [],
        aggregated: {
          totals: emptyTotals(),
          currentState: emptyCurrentState(),
          categories: [],
          patterns: [],
        },
      } satisfies TeamsExecutiveResponse);
    }

    const allProjectIds = teams.flatMap((t) =>
      normalizeProjectIds(t.projectIds),
    );

    const projects = await Project.find({
      _id: { $in: allProjectIds },
      tenantId,
    })
      .select("_id name")
      .lean();

    const projectIdToTeamId = new Map<string, string>();
    for (const t of teams) {
      for (const pId of normalizeProjectIds(t.projectIds)) {
        projectIdToTeamId.set(pId.toString(), t._id.toString());
      }
    }

    const projectNameToTeamId = new Map<string, string>();
    for (const p of projects) {
      const tId = projectIdToTeamId.get(p._id.toString());
      if (tId) projectNameToTeamId.set(p.name, tId);
    }

    const teamIdToName = new Map<string, string>();
    for (const t of teams) teamIdToName.set(t._id.toString(), t.name);

    // ============================================================
    // 2. Facet — fluxo + aging + risco
    // ============================================================
    const now = new Date();
    const soonDate = new Date(now.getTime() + 3 * 86_400_000);

    const [facets] = await Observation.aggregate<{
      byProjectSevStatus: ByProjectSevStatusRow[];
      byCategory: ByCategoryRow[];
      byPattern: ByPatternRow[];
      currentRaw: CurrentRawRow[];
      currentAging: AgingRow[];
    }>([
      {
        $facet: {
          // --- Fluxo (respeita range) ---
          byProjectSevStatus: [
            { $match: flowMatch },
            {
              $group: {
                _id: {
                  project: "$project",
                  severity: "$severity",
                  status: "$status",
                },
                count: { $sum: 1 },
              },
            },
          ],
          byCategory: [
            { $match: flowMatch },
            { $match: { patternId: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: {
                  project: "$project",
                  category: "$category",
                  patternId: "$patternId",
                },
              },
            },
            {
              $group: {
                _id: {
                  project: "$_id.project",
                  category: "$_id.category",
                },
                observations: { $sum: 1 },
                patterns: { $addToSet: "$_id.patternId" },
              },
            },
          ],
          byPattern: [
            { $match: flowMatch },
            { $match: { patternId: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: {
                  project: "$project",
                  patternId: "$patternId",
                  category: "$category",
                },
                count: { $sum: 1 },
              },
            },
          ],

          // --- Estado atual (SEM range) ---
          // Retorna raw findings; a agregação em memória cobre
          // tanto os KPIs quanto o cálculo de risco.
          currentRaw: [
            { $match: openMatch },
            {
              $project: {
                _id: 0,
                project: 1,
                severity: 1,
                status: 1,
                hitCount: 1,
                firstSeen: 1,
                slaDueAt: 1,
              },
            },
          ],
          currentAging: [
            { $match: openMatch },
            {
              $addFields: {
                ageDays: {
                  $divide: [{ $subtract: [now, "$firstSeen"] }, 86_400_000],
                },
              },
            },
            {
              $project: {
                project: 1,
                bucket: {
                  $switch: {
                    branches: [
                      { case: { $lt: ["$ageDays", 31] }, then: "0-30" },
                      { case: { $lt: ["$ageDays", 61] }, then: "31-60" },
                      { case: { $lt: ["$ageDays", 91] }, then: "61-90" },
                    ],
                    default: "90+",
                  },
                },
              },
            },
            {
              $group: {
                _id: { project: "$project", bucket: "$bucket" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // ============================================================
    // 3. Nomes de patterns (para o flow)
    // ============================================================
    const patternIdStrings = new Set<string>();
    for (const row of facets.byPattern) {
      patternIdStrings.add(String(row._id.patternId));
    }

    const validPatternIds = Array.from(patternIdStrings)
      .filter((id) => /^[a-f0-9]{24}$/i.test(id))
      .map((id) => toObjectId(id))
      .filter((id): id is NonNullable<typeof id> => id !== null);

    const patternDocs = await VulnerabilityPattern.find({
      _id: { $in: validPatternIds },
    })
      .select("_id dbId name")
      .lean();

    // Dois mapas: um para exibição (`name`), outro para relatórios (`dbId`).
    const patternNameMap = new Map<string, string>();
    const patternDbIdMap = new Map<string, string>();
    for (const p of patternDocs) {
      patternNameMap.set(p._id.toString(), p.name);
      if (p.dbId) patternDbIdMap.set(p._id.toString(), p.dbId);
    }

    // ============================================================
    // 4. Risco em 3 níveis — construído a partir de currentRaw
    // ============================================================
    const findingsByProject = new Map<string, RiskFinding[]>();
    for (const f of facets.currentRaw) {
      const key = f.project ?? "";
      const arr = findingsByProject.get(key) ?? [];
      arr.push({
        severity: f.severity as RiskSeverity,
        status: f.status as RiskStatus,
        hitCount: f.hitCount ?? 0,
        firstSeen: f.firstSeen,
        slaDueAt: f.slaDueAt,
      });
      findingsByProject.set(key, arr);
    }

    const riskByProject = new Map<string, RiskAggregate>();
    for (const [project, findings] of findingsByProject) {
      riskByProject.set(project, aggregateRisk(findings));
    }

    const findingsByTeam = new Map<string, RiskFinding[]>();
    for (const [project, findings] of findingsByProject) {
      const tId = projectNameToTeamId.get(project);
      if (!tId) continue;
      const arr = findingsByTeam.get(tId) ?? [];
      arr.push(...findings);
      findingsByTeam.set(tId, arr);
    }

    const riskByTeam = new Map<string, RiskAggregate>();
    for (const [tId, findings] of findingsByTeam) {
      riskByTeam.set(tId, aggregateRisk(findings));
    }

    const allFindings: RiskFinding[] = [];
    for (const findings of findingsByProject.values()) {
      allFindings.push(...findings);
    }
    const aggregateCurrentRisk = aggregateRisk(allFindings);

    // ============================================================
    // 5. Acumuladores por time
    // ============================================================
    interface TeamAccumulator {
      totals: TeamSeverityTotals;
      currentTotals: CurrentStateTotals;
      currentAging: CurrentStateAging;
      currentProjects: Map<string, CurrentStateProjectRow>;
      categoryMap: Map<string, { observations: number; patterns: Set<string> }>;
      patternMap: Map<
        string,
        {
          patternId: string;
          patternName: string;
          category: string;
          observations: number;
        }
      >;
    }

    const teamAcc = new Map<string, TeamAccumulator>();
    for (const t of teams) {
      teamAcc.set(t._id.toString(), {
        totals: emptyTotals(),
        currentTotals: emptyCurrentTotals(),
        currentAging: emptyAging(),
        currentProjects: new Map(),
        categoryMap: new Map(),
        patternMap: new Map(),
      });
    }

    // 5a. Fluxo — severidade + status
    for (const row of facets.byProjectSevStatus) {
      const tId = projectNameToTeamId.get(row._id.project);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const sev = row._id.severity || "unknown";
      const status = row._id.status || "unknown";
      const count = row.count;

      acc.totals.total += count;
      if (sev === "critical") acc.totals.critical += count;
      else if (sev === "high") acc.totals.high += count;
      else if (sev === "medium") acc.totals.medium += count;
      else if (sev === "low") acc.totals.low += count;

      if (status === "open") acc.totals.open += count;
      else if (status === "resolved") acc.totals.resolved += count;
      else if (status === "recurring") acc.totals.recurring += count;
      else if (status === "wont_fix") acc.totals.wontFix += count;
      else if (status === "expired") acc.totals.expired += count;
    }

    // 5b. Estado atual — KPIs por severidade + SLA
    for (const f of facets.currentRaw) {
      const tId = f.project ? projectNameToTeamId.get(f.project) : undefined;
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const sev = f.severity || "unknown";
      const due = f.slaDueAt ? new Date(f.slaDueAt) : null;
      const isOverdue = due && due < now;
      const isAtRisk = due && !isOverdue && due < soonDate;

      acc.currentTotals.total += 1;
      if (sev === "critical") acc.currentTotals.critical += 1;
      else if (sev === "high") acc.currentTotals.high += 1;
      else if (sev === "medium") acc.currentTotals.medium += 1;
      else if (sev === "low") acc.currentTotals.low += 1;

      if (isOverdue) acc.currentTotals.overdue += 1;
      else if (isAtRisk) acc.currentTotals.atRisk += 1;
      else acc.currentTotals.onTrack += 1;

      // Projeto dentro do time
      const projectKey = f.project ?? "";
      if (!projectKey) continue;

      const cur = acc.currentProjects.get(projectKey) ?? {
        project: projectKey,
        teamName: teamIdToName.get(tId) ?? "—",
        risk: emptyRisk(),
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        overdue: 0,
      };
      cur.total += 1;
      if (sev === "critical") cur.critical += 1;
      else if (sev === "high") cur.high += 1;
      else if (sev === "medium") cur.medium += 1;
      else if (sev === "low") cur.low += 1;
      if (isOverdue) cur.overdue += 1;
      acc.currentProjects.set(projectKey, cur);
    }

    // Atribui o risco consolidado por projeto (vem do cálculo global)
    for (const acc of teamAcc.values()) {
      for (const [projectKey, row] of acc.currentProjects) {
        row.risk = riskByProject.get(projectKey) ?? emptyRisk();
      }
    }

    // 5c. Aging
    for (const row of facets.currentAging) {
      const tId = projectNameToTeamId.get(row._id.project);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const count = row.count;
      switch (row._id.bucket) {
        case "0-30":
          acc.currentAging.days0To30 += count;
          break;
        case "31-60":
          acc.currentAging.days31To60 += count;
          break;
        case "61-90":
          acc.currentAging.days61To90 += count;
          break;
        case "90+":
          acc.currentAging.days90Plus += count;
          break;
      }
    }

    // 5d. Categorias (fluxo)
    for (const row of facets.byCategory) {
      const tId = projectNameToTeamId.get(row._id.project);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const cat = row._id.category || "Sem Categoria";
      const existing = acc.categoryMap.get(cat) ?? {
        observations: 0,
        patterns: new Set<string>(),
      };
      existing.observations += row.observations;
      for (const pId of row.patterns) existing.patterns.add(String(pId));
      acc.categoryMap.set(cat, existing);
    }

    // 5e. Padrões (fluxo)
    for (const row of facets.byPattern) {
      const tId = projectNameToTeamId.get(row._id.project);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const pId = String(row._id.patternId);
      const existing = acc.patternMap.get(pId) ?? {
        patternId: pId,
        dbId: patternDbIdMap.get(pId) ?? null,
        patternName: patternNameMap.get(pId) ?? "(padrão desconhecido)",
        category: row._id.category || "Sem Categoria",
        observations: 0,
      };
      existing.observations += row.count;
      acc.patternMap.set(pId, existing);
    }

    // ============================================================
    // 6. Monta as entradas por time
    // ============================================================
    const entries: TeamExecutiveEntry[] = [];
    for (const [tId, acc] of teamAcc) {
      if (acc.totals.total === 0 && acc.currentTotals.total === 0) continue;

      const categories: TeamCategoryRow[] = Array.from(
        acc.categoryMap.entries(),
      )
        .map(([category, v]) => ({
          category,
          observations: v.observations,
          patterns: v.patterns.size,
        }))
        .sort((a, b) => b.observations - a.observations)
        .slice(0, TOP_CATEGORIES);

      const patterns: TeamPatternRow[] = Array.from(acc.patternMap.values())
        .sort((a, b) => b.observations - a.observations)
        .slice(0, TOP_PATTERNS);

      const currentProjects = Array.from(acc.currentProjects.values())
        .sort((a, b) => b.risk.score - a.risk.score || b.total - a.total)
        .slice(0, TOP_EXPOSED_PROJECTS);

      entries.push({
        teamId: tId,
        teamName: teamIdToName.get(tId) ?? "—",
        totals: acc.totals,
        currentState: {
          risk: riskByTeam.get(tId) ?? emptyRisk(),
          totals: acc.currentTotals,
          aging: acc.currentAging,
          projects: currentProjects,
        },
        categories,
        patterns,
      });
    }

    // Ordena por risco atual desc — o pior primeiro
    entries.sort(
      (a, b) => b.currentState.risk.score - a.currentState.risk.score,
    );

    // ============================================================
    // 7. Rollup agregado
    // ============================================================
    const aggregated: TeamsExecutiveResponse["aggregated"] = {
      totals: emptyTotals(),
      currentState: {
        risk: aggregateCurrentRisk,
        totals: emptyCurrentTotals(),
        aging: emptyAging(),
        projects: [],
      },
      categories: [],
      patterns: [],
    };

    const aggCategoryMap = new Map<
      string,
      { observations: number; patterns: Set<string> }
    >();
    const aggPatternMap = new Map<string, TeamPatternRow>();
    const aggCurrentProjects = new Map<string, CurrentStateProjectRow>();

    for (const entry of entries) {
      const t = entry.totals;
      aggregated.totals.total += t.total;
      aggregated.totals.critical += t.critical;
      aggregated.totals.high += t.high;
      aggregated.totals.medium += t.medium;
      aggregated.totals.low += t.low;
      aggregated.totals.open += t.open;
      aggregated.totals.resolved += t.resolved;
      aggregated.totals.recurring += t.recurring;
      aggregated.totals.wontFix += t.wontFix;
      aggregated.totals.expired += t.expired;

      const cs = entry.currentState;
      aggregated.currentState.totals.total += cs.totals.total;
      aggregated.currentState.totals.critical += cs.totals.critical;
      aggregated.currentState.totals.high += cs.totals.high;
      aggregated.currentState.totals.medium += cs.totals.medium;
      aggregated.currentState.totals.low += cs.totals.low;
      aggregated.currentState.totals.overdue += cs.totals.overdue;
      aggregated.currentState.totals.atRisk += cs.totals.atRisk;
      aggregated.currentState.totals.onTrack += cs.totals.onTrack;

      aggregated.currentState.aging.days0To30 += cs.aging.days0To30;
      aggregated.currentState.aging.days31To60 += cs.aging.days31To60;
      aggregated.currentState.aging.days61To90 += cs.aging.days61To90;
      aggregated.currentState.aging.days90Plus += cs.aging.days90Plus;

      for (const p of cs.projects) {
        const existing = aggCurrentProjects.get(p.project);
        if (existing) {
          existing.total += p.total;
          existing.critical += p.critical;
          existing.high += p.high;
          existing.medium += p.medium;
          existing.low += p.low;
          existing.overdue += p.overdue;
          // risk já é o consolidado do projeto — substitui
          existing.risk = p.risk;
        } else {
          aggCurrentProjects.set(p.project, { ...p });
        }
      }

      const acc = teamAcc.get(entry.teamId);
      if (acc) {
        for (const [cat, v] of acc.categoryMap) {
          const cur = aggCategoryMap.get(cat) ?? {
            observations: 0,
            patterns: new Set<string>(),
          };
          cur.observations += v.observations;
          for (const p of v.patterns) cur.patterns.add(p);
          aggCategoryMap.set(cat, cur);
        }
        for (const [pId, v] of acc.patternMap) {
          const cur = aggPatternMap.get(pId) ?? {
            patternId: pId,
            patternName: v.patternName,
            category: v.category,
            observations: 0,
          };
          cur.observations += v.observations;
          aggPatternMap.set(pId, cur);
        }
      }
    }

    aggregated.categories = Array.from(aggCategoryMap.entries())
      .map(([category, v]) => ({
        category,
        observations: v.observations,
        patterns: v.patterns.size,
      }))
      .sort((a, b) => b.observations - a.observations)
      .slice(0, TOP_CATEGORIES);

    aggregated.patterns = Array.from(aggPatternMap.values())
      .sort((a, b) => b.observations - a.observations)
      .slice(0, TOP_PATTERNS);

    aggregated.currentState.projects = Array.from(aggCurrentProjects.values())
      .sort((a, b) => b.risk.score - a.risk.score || b.total - a.total)
      .slice(0, TOP_EXPOSED_PROJECTS);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      scope,
      teams: entries,
      aggregated,
    } satisfies TeamsExecutiveResponse);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório executivo" },
      { status: 500 },
    );
  }
}
