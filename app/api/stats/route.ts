// app/api/stats/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { subDays, format } from "date-fns";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Estatísticas agregadas das observations do tenant.
 *
 * **Fonte única de filtros**: usa `buildObservationFilters` — os mesmos
 * filtros aplicados aqui são aplicados em `/api/observations` e
 * `/api/dashboard/stats`. Isso garante que o `kpi.total` retornado aqui
 * bata com o total mostrado nas outras telas para a mesma DBQL + time +
 * janela temporal.
 *
 * Aceita `range=1h|24h|7d|14d|30d|90d|all` (preset) **ou** `from` + `to`
 * (ISO, custom). Quando ambos vêm preenchidos, `from`/`to` têm precedência.
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

    const { match } = await buildObservationFilters({
      tenantId,
      dbqlId,
      teamId,
      range,
      rangeFrom,
      rangeTo,
    });

    // `projectId` é específico desta tela — adiciona como cláusula extra.
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
    const categoryData = await Observation.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const categoryTotals = categoryData.map((d: any) => ({
      label: d._id || "Sem Categoria",
      value: d.count,
    }));

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
    // Evolução — deriva `days` do mesmo range usado no match.
    // ============================================================
    let days = 30;
    if (range === "1h") days = 1;
    else if (range === "24h") days = 1;
    else if (range === "7d") days = 7;
    else if (range === "14d") days = 14;
    else if (range === "30d") days = 30;
    else if (range === "90d") days = 90;
    else if (rangeFrom && rangeTo) {
      // Custom: calcula em dias entre os extremos (limitado a 180 para o gráfico)
      const ms = new Date(rangeTo).getTime() - new Date(rangeFrom).getTime();
      days = Math.min(180, Math.max(1, Math.ceil(ms / 86_400_000)));
    }

    const dateFilter = { $gte: subDays(new Date(), days) };

    const [evolutionSeverityData, evolutionStatusData] = await Promise.all([
      Observation.aggregate([
        { $match: { ...baseMatch, firstSeen: dateFilter } },
        {
          $group: {
            _id: {
              day: {
                $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" },
              },
              severity: "$severity",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1 } },
      ]),
      Observation.aggregate([
        { $match: { ...baseMatch, firstSeen: dateFilter } },
        {
          $group: {
            _id: {
              day: {
                $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" },
              },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.day": 1 } },
      ]),
    ]);

    const today = new Date();
    const chartData: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = format(subDays(today, i), "yyyy-MM-dd");
      chartData.push({
        label: key,
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
      });
    }

    const dayMap = new Map<string, number>();
    chartData.forEach((item, index) => dayMap.set(item.label, index));

    evolutionSeverityData.forEach((item: any) => {
      const idx = dayMap.get(item._id.day);
      if (idx === undefined) return;
      const sev = item._id.severity || "unknown";
      chartData[idx][sev] = (chartData[idx][sev] || 0) + item.count;
      chartData[idx].total += item.count;
    });

    evolutionStatusData.forEach((item: any) => {
      const idx = dayMap.get(item._id.day);
      if (idx === undefined) return;
      const status = item._id.status || "unknown";
      if (status === "wont_fix") chartData[idx].wontFix += item.count;
      else if (status === "resolved") chartData[idx].resolved += item.count;
      else if (status === "open") chartData[idx].open += item.count;
      else if (status === "recurring") chartData[idx].recurring += item.count;
      else if (status === "expired") chartData[idx].expired += item.count;
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
