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
import type {
  TeamExecutiveEntry,
  TeamPatternRow,
  TeamProjectRow,
  TeamSeverityTotals,
  TeamsExecutiveResponse,
} from "@/types/ITeamsExecutive";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOP_CATEGORIES = 10;
const TOP_PATTERNS = 10;
const TOP_PROJECTS = 10;

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

/**
 * Gera o relatório executivo comparativo entre times.
 *
 * **Respeita os mesmos filtros de `/api/observations` e `/api/stats`** —
 * usa `buildObservationFilters` para combinar DBQL + time + janela
 * temporal. Quando `teamId=all`, retorna **todos** os times do tenant;
 * quando um `teamId` específico é passado, retorna apenas ele.
 *
 * Cada entrada inclui:
 *  - `totals`: contagem por severidade e status
 *  - `categories`: top 10 categorias com nº de padrões distintos
 *  - `patterns`: top 10 padrões com categoria e contagem
 *  - `projects`: top 10 projetos com quebra por severidade
 *
 * O bloco `aggregated` combina todos os times visíveis (rollup),
 * usado quando a UI mostra "Global".
 *
 * @summary Relatório executivo entre times
 * @tags Stats, Teams
 * @route GET /api/stats/teams-executive
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP.
 * @returns {Promise<NextResponse>} `TeamsExecutiveResponse`.
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

    const { match: baseMatch } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId,
      range,
      rangeFrom,
      rangeTo,
    });

    const scope: "global" | "team" =
      !teamId || teamId === "all" ? "global" : "team";

    // ============================================================
    // 1. Times + projetos (respeitando o filtro)
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
          categories: [],
          patterns: [],
          projects: [],
        },
      } satisfies TeamsExecutiveResponse);
    }

    // Coleta todos os projectIds referenciados pelos times visíveis
    const allProjectIds = teams.flatMap((t) =>
      normalizeProjectIds(t.projectIds),
    );

    const projects = await Project.find({
      _id: { $in: allProjectIds },
      tenantId,
    })
      .select("_id name")
      .lean();

    // Mapas auxiliares
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
    // 2. Agregação em uma única passada com $facet
    // ============================================================
    const [facets] = await Observation.aggregate<{
      byProjectSevStatus: ByProjectSevStatusRow[];
      byCategory: ByCategoryRow[];
      byPattern: ByPatternRow[];
    }>([
      { $match: baseMatch },
      {
        $facet: {
          byProjectSevStatus: [
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
        },
      },
    ]);

    // ============================================================
    // 3. Carrega nomes dos patterns presentes no resultado
    // ============================================================
    const patternIdStrings = new Set<string>();
    for (const row of facets.byPattern) {
      patternIdStrings.add(String(row._id.patternId));
    }

    const validPatternIds = Array.from(patternIdStrings)
      .filter((id) => id.match(/^[a-f0-9]{24}$/i))
      .map((id) => toObjectId(id))
      .filter((id): id is NonNullable<typeof id> => id !== null);

    const patternDocs = await VulnerabilityPattern.find({
      _id: { $in: validPatternIds },
    })
      .select("_id name")
      .lean();

    const patternNameMap = new Map<string, string>();
    for (const p of patternDocs) {
      patternNameMap.set(p._id.toString(), p.name);
    }

    // ============================================================
    // 4. Estruturas por time (acumuladores)
    // ============================================================
    interface TeamAccumulator {
      totals: TeamSeverityTotals;
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
      projectMap: Map<string, TeamProjectRow>;
    }

    const teamAcc = new Map<string, TeamAccumulator>();
    for (const t of teams) {
      teamAcc.set(t._id.toString(), {
        totals: emptyTotals(),
        categoryMap: new Map(),
        patternMap: new Map(),
        projectMap: new Map(),
      });
    }

    // 4a. Totais por severidade + status
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

    // 4b. Categorias (por time)
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

    // 4c. Padrões (por time)
    for (const row of facets.byPattern) {
      const tId = projectNameToTeamId.get(row._id.project);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      const pId = String(row._id.patternId);
      const existing = acc.patternMap.get(pId) ?? {
        patternId: pId,
        patternName: patternNameMap.get(pId) ?? "(padrão desconhecido)",
        category: row._id.category || "Sem Categoria",
        observations: 0,
      };
      existing.observations += row.count;
      acc.patternMap.set(pId, existing);
    }

    // 4d. Projetos (por time) — usa os totais já calculados para quebra por sev
    const projectBreakdown = new Map<
      string,
      {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
      }
    >();
    for (const row of facets.byProjectSevStatus) {
      const key = row._id.project;
      const cur = projectBreakdown.get(key) ?? {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      cur.total += row.count;
      const sev = row._id.severity;
      if (sev === "critical") cur.critical += row.count;
      else if (sev === "high") cur.high += row.count;
      else if (sev === "medium") cur.medium += row.count;
      else if (sev === "low") cur.low += row.count;
      projectBreakdown.set(key, cur);
    }

    for (const [projectName, breakdown] of projectBreakdown) {
      const tId = projectNameToTeamId.get(projectName);
      if (!tId) continue;
      const acc = teamAcc.get(tId);
      if (!acc) continue;

      acc.projectMap.set(projectName, {
        project: projectName,
        teamName: teamIdToName.get(tId) ?? "—",
        total: breakdown.total,
        critical: breakdown.critical,
        high: breakdown.high,
        medium: breakdown.medium,
        low: breakdown.low,
      });
    }

    // ============================================================
    // 5. Monta as entradas por time (ordenadas por total desc)
    // ============================================================
    const entries: TeamExecutiveEntry[] = [];
    for (const [tId, acc] of teamAcc) {
      // Filtra times sem observações para não poluir o comparativo
      if (acc.totals.total === 0) continue;

      const categories = Array.from(acc.categoryMap.entries())
        .map(([category, v]) => ({
          category,
          observations: v.observations,
          patterns: v.patterns.size,
        }))
        .sort((a, b) => b.observations - a.observations)
        .slice(0, TOP_CATEGORIES);

      const patterns = Array.from(acc.patternMap.values())
        .sort((a, b) => b.observations - a.observations)
        .slice(0, TOP_PATTERNS);

      const projects = Array.from(acc.projectMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_PROJECTS);

      entries.push({
        teamId: tId,
        teamName: teamIdToName.get(tId) ?? "—",
        totals: acc.totals,
        categories,
        patterns,
        projects,
      });
    }

    entries.sort((a, b) => b.totals.total - a.totals.total);

    // ============================================================
    // 6. Rollup para o "agregado" (usado quando Global)
    // ============================================================
    const aggregated: TeamsExecutiveResponse["aggregated"] = {
      totals: emptyTotals(),
      categories: [],
      patterns: [],
      projects: [],
    };

    const aggCategoryMap = new Map<
      string,
      { observations: number; patterns: Set<string> }
    >();
    const aggPatternMap = new Map<string, TeamPatternRow>();

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

      // Categorias: precisa recomputar pattern sets a partir do acumulador bruto
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

    aggregated.projects = entries
      .flatMap((e) => e.projects)
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_PROJECTS);

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
