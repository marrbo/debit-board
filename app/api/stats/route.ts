// app/api/stats/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { subDays, subHours, format } from "date-fns";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EvolutionBucket {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  open: number;
  recurring: number;
  resolved: number;
  wontFix: number;
  expired: number;
}

function emptyBucket(): EvolutionBucket {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
    open: 0,
    recurring: 0,
    resolved: 0,
    wontFix: 0,
    expired: 0,
  };
}

/**
 * Estatísticas agregadas das observations do tenant.
 *
 * **Fonte única de filtros**: usa `buildObservationFilters` — os mesmos
 * filtros aplicados aqui são aplicados em `/api/observations` e
 * `/api/dashboard/stats`. Isso garante que TODOS os números retornados
 * aqui (KPI, severidade, categoria, projetos, evolução) contem
 * **exatamente o mesmo conjunto** de observations para o mesmo range.
 *
 * Aceita `range=1h|24h|7d|14d|30d|90d|all` (preset) **ou** `from` + `to`
 * (ISO, custom). Quando ambos vêm preenchidos, `from`/`to` têm precedência.
 *
 * A janela de exibição do gráfico de evolução é derivada do próprio
 * range. Quando `all`, usa o intervalo real dos dados (min/max de
 * `firstSeen`). Nunca há um filtro "extra" por cima do range.
 *
 * @summary Estatísticas agregadas do tenant
 * @tags Stats
 * @route GET /api/stats
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP.
 * @returns {Promise<NextResponse>} `{ kpi, severityTotals, categoryTotals, projectTotals, chartData }`.
 * @throws {401} Sessão ausente ou inválida.
 * @throws {423} Usuário autenticado sem tenant associado.
 * @throws {500} Erro inesperado (registrado no Sentry).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    const tenantId = toObjectId(auth.user.tenantId);
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const teamId = searchParams.get("teamId");
    const dbqlId = searchParams.get("q");
    const range = searchParams.get("range");
    const rangeFrom = searchParams.get("from");
    const rangeTo = searchParams.get("to");

    // ============================================================
    // Filtro único — respeita DBQL + time + range. Nada além disso.
    // ============================================================
    const { match } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId,
      range,
      rangeFrom,
      rangeTo,
    });

    const baseMatch: Record<string, unknown> =
      projectId && projectId !== "all"
        ? { $and: [match, { project: projectId }] }
        : match;

    // ============================================================
    // KPIs
    // ============================================================
    const kpiResult = await Observation.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
          recurring: {
            $sum: { $cond: [{ $eq: ["$status", "recurring"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          wontFix: {
            $sum: { $cond: [{ $eq: ["$status", "wont_fix"] }, 1, 0] },
          },
          expired: {
            $sum: { $cond: [{ $lt: ["$slaDueAt", new Date()] }, 1, 0] },
          },
        },
      },
    ]);

    const kpi = kpiResult[0] || {
      total: 0,
      open: 0,
      recurring: 0,
      resolved: 0,
      wontFix: 0,
      expired: 0,
    };

    // ============================================================
    // Severidades
    // ============================================================
    const severityData = await Observation.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const severityTotals: Record<string, number> = {};
    severityData.forEach((d: any) => {
      severityTotals[d._id || "unknown"] = d.count;
    });

    // ============================================================
    // Categorias
    // ============================================================
    const [categoryData, categoryGroupData] = await Promise.all([
      Observation.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Observation.aggregate([
        {
          $match: {
            ...baseMatch,
            patternId: { $exists: true, $nin: [null, ""] },
          },
        },
        { $group: { _id: { category: "$category", patternId: "$patternId" } } },
        { $group: { _id: "$_id.category", count: { $sum: 1 } } },
      ]),
    ]);

    const categoryTotals = categoryData.map((d: any) => ({
      label: d._id || "Sem Categoria",
      value: d.count,
    }));

    const categoryGroupTotals: Record<string, number> = {};
    categoryGroupData.forEach((item: any) => {
      categoryGroupTotals[item._id] = item.count;
    });

    if (Object.values(categoryGroupTotals).reduce((a, b) => a + b, 0) === 0) {
      for (const c of categoryTotals) categoryGroupTotals[c.label] = c.value;
    }

    // ============================================================
    // Projetos (TOP 10 + detalhes)
    // ============================================================
    const [projectData, projectStatusData, projectSeverityData] =
      await Promise.all([
        Observation.aggregate([
          { $match: baseMatch },
          { $group: { _id: "$project", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Observation.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: { project: "$project", status: "$status" },
              count: { $sum: 1 },
            },
          },
        ]),
        Observation.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: { project: "$project", severity: "$severity" },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const projectStatusTotals = projectStatusData.reduce(
      (acc: any, item: any) => {
        const proj = item._id.project || "Sem Projeto";
        const status = item._id.status || "unknown";
        (acc[proj] ??= {})[status] = item.count;
        return acc;
      },
      {},
    );

    const projectSeverityTotals = projectSeverityData.reduce(
      (acc: any, item: any) => {
        const proj = item._id.project || "Sem Projeto";
        const sev = item._id.severity || "unknown";
        (acc[proj] ??= {})[sev] = item.count;
        return acc;
      },
      {},
    );

    const projectTotalsArray = projectData.map((d: any) => ({
      label: d._id || "Sem Projeto",
      value: d.count,
      status: projectStatusTotals[d._id || "Sem Projeto"] || {},
      severity: projectSeverityTotals[d._id || "Sem Projeto"] || {},
    }));

    // ============================================================
    // Evolução — respeita o range, sem filtro extra.
    // ============================================================
    // 1. Determina a janela de exibição a partir do range.
    //    - Presets: [agora - N, agora]
    //    - Custom:  [from, to]
    //    - "all":   [min(firstSeen) dos dados, agora]
    // ------------------------------------------------------------
    const rangeEnd = new Date();
    let rangeStart: Date;

    if (rangeFrom && rangeTo) {
      rangeStart = new Date(rangeFrom);
      rangeEnd.setTime(new Date(rangeTo).getTime());
    } else if (range === "1h") {
      rangeStart = subHours(rangeEnd, 1);
    } else if (range === "24h") {
      rangeStart = subHours(rangeEnd, 24);
    } else if (range === "7d") {
      rangeStart = subDays(rangeEnd, 7);
    } else if (range === "14d") {
      rangeStart = subDays(rangeEnd, 14);
    } else if (range === "30d") {
      rangeStart = subDays(rangeEnd, 30);
    } else if (range === "90d") {
      rangeStart = subDays(rangeEnd, 90);
    } else {
      // "all" ou valor desconhecido → usa a extensão real dos dados.
      const minResult = await Observation.aggregate([
        { $match: baseMatch },
        { $group: { _id: null, min: { $min: "$firstSeen" } } },
      ]);
      const dataMin: Date | undefined = minResult[0]?.min;
      rangeStart = dataMin ? new Date(dataMin) : subDays(rangeEnd, 30);
    }

    // ------------------------------------------------------------
    // 2. Agrega usando o MESMO `baseMatch` — sem filtro extra.
    // ------------------------------------------------------------
    const evolutionData = await Observation.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            day: {
              $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" },
            },
            severity: "$severity",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    // ------------------------------------------------------------
    // 3. Gera os buckets por dia para toda a janela.
    // ------------------------------------------------------------
    const chartData: Array<{ label: string } & EvolutionBucket> = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(rangeEnd);
    endDay.setHours(23, 59, 59, 999);

    while (cursor <= endDay) {
      chartData.push({ label: format(cursor, "yyyy-MM-dd"), ...emptyBucket() });
      cursor.setDate(cursor.getDate() + 1);
    }

    const dayMap = new Map<string, number>();
    chartData.forEach((item, index) => dayMap.set(item.label, index));

    // ------------------------------------------------------------
    // 4. Preenche os buckets com o resultado da agregação.
    //    A soma de todos os buckets == `kpi.total`.
    // ------------------------------------------------------------
    evolutionData.forEach((row: any) => {
      const idx = dayMap.get(row._id.day);
      if (idx === undefined) return;

      const b = chartData[idx];
      const sev = row._id.severity || "unknown";
      const status = row._id.status || "unknown";
      const count = row.count;

      if (sev === "critical") b.critical += count;
      else if (sev === "high") b.high += count;
      else if (sev === "medium") b.medium += count;
      else if (sev === "low") b.low += count;
      b.total += count;

      if (status === "open") b.open += count;
      else if (status === "resolved") b.resolved += count;
      else if (status === "recurring") b.recurring += count;
      else if (status === "wont_fix") b.wontFix += count;
      else if (status === "expired") b.expired += count;
    });

    return NextResponse.json({
      kpi: {
        total: kpi.total,
        open: kpi.open,
        recurring: kpi.recurring,
        resolved: kpi.resolved,
        wontFix: kpi.wontFix,
        accepted: kpi.open + kpi.recurring,
        expired: kpi.expired,
      },
      severityTotals,
      categoryTotals,
      categoryGroupTotals,
      projectTotals: projectTotalsArray,
      chartData,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Erro ao carregar estatísticas" },
      { status: 500 },
    );
  }
}
