// app/api/stats/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { Project } from "@/models/Project";
import { Team } from "@/models/Team";
import { SavedQuery } from "@/models/SavedQuery";
import { subDays, format } from "date-fns";
import { parseDBQL } from "@/lib/parseDBQL";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import mongoose from "mongoose";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Retorna estatísticas agregadas das observations do tenant.
 *
 * Este endpoint expõe a operação get em /api/stats.
 *
 * Suporta:
 *  - `range`: janela temporal (`24h`, `7d`, `14d`, `30d`). Default: `30d`.
 *  - `projectId`: filtra por um projeto específico (ignorado quando `all`).
 *  - `teamId`: filtra pelo time selecionado. `all` ou ausente = sem filtro.
 *  - `q`: filtra por consulta DBQL. Aceita **ID de SavedQuery** (resolvido
 *    server-side e respeitando visibilidade) ou **DBQL cru** (compatibilidade
 *    com cliques em fatias de gráfico).
 *
 * @summary Estatísticas agregadas do tenant
 * @description Retorna KPIs (totais, status, SLA), distribuição por severidade
 *              e categoria, top 10 projetos (com quebra por status e severidade)
 *              e série temporal para os gráficos de evolução.
 * @tags Stats
 * @route GET /api/stats
 * @async
 * @access analyst, viewer
 * @function GET
 * @param {NextRequest} req - Requisição HTTP contendo os query params
 *                            `range`, `projectId`, `teamId` e `q`.
 * @returns {Promise<NextResponse>} JSON com `kpi`, `severityTotals`,
 *                                  `categoryTotals`, `projectTotals` e `chartData`.
 * @throws {401} Sessão ausente ou inválida.
 * @throws {423} Usuário autenticado sem tenant associado.
 * @throws {500} Erro inesperado ao agregar dados (registrado no Sentry).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    const tenantId = toObjectId(auth.user.tenantId);
    const userSub = auth.user.sub;

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";
    const projectId = searchParams.get("projectId");
    const teamId = searchParams.get("teamId");
    const qParam = searchParams.get("q");

    // ============================================================
    // 🔥 Resolve `q`: pode ser ID de saved query OU DBQL cru
    // ============================================================
    let finalSearchQuery = "";
    if (qParam) {
      const dbqlId = toObjectId(qParam);
      if (dbqlId) {
        const savedQuery = await SavedQuery.findOne({
          _id: { $eq: dbqlId },
          $or: [
            { visibility: { $eq: "public" } },
            { visibility: { $eq: "shared" }, tenantId: { $eq: tenantId } },
            {
              visibility: { $eq: "private" },
              tenantId: { $eq: tenantId },
              sub: { $eq: userSub },
            },
            {
              visibility: { $eq: "temporary" },
              tenantId: { $eq: tenantId },
              sub: { $eq: userSub },
            },
          ],
        }).lean();

        if (savedQuery?.queryString) {
          finalSearchQuery = savedQuery.queryString;
        }
      } else {
        // Não é ObjectId válido → trata como DBQL cru (compat. e slices)
        finalSearchQuery = qParam;
      }
    }

    // ============================================================
    // 🔥 Team filter (mesmo padrão do /api/dashboard/stats)
    // ============================================================
    let allowedProjectNames: string[] | null = null;
    if (teamId && teamId !== "all") {
      const teamObjectId = toObjectId(teamId);
      if (teamObjectId) {
        const team = await Team.findById(teamObjectId).lean();
        if (team) {
          const allowedProjectIds = (team.projectIds || []).map((id: any) => {
            if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
              return new mongoose.Types.ObjectId(id);
            }
            return id;
          });

          const teamProjects = await Project.find({
            _id: { $in: allowedProjectIds },
          })
            .select("name")
            .lean();

          allowedProjectNames = teamProjects.map((p) => p.name);
        }
      }
    }

    // ============================================================
    // Match base
    // ============================================================
    let baseMatch: Record<string, unknown> = {};
    if (tenantId) baseMatch.tenantId = tenantId;

    if (range === "7d") baseMatch.firstSeen = { $gte: subDays(new Date(), 7) };
    else if (range === "14d")
      baseMatch.firstSeen = { $gte: subDays(new Date(), 14) };
    else if (range === "30d")
      baseMatch.firstSeen = { $gte: subDays(new Date(), 30) };

    if (projectId && projectId !== "all") baseMatch.project = projectId;

    if (allowedProjectNames !== null && allowedProjectNames.length > 0) {
      baseMatch.project = { $in: allowedProjectNames };
    }

    if (finalSearchQuery) {
      const parsedMatch = parseDBQL(finalSearchQuery);
      if (parsedMatch && Object.keys(parsedMatch).length > 0) {
        baseMatch = { $and: [baseMatch, parsedMatch] };
      }
    }

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
    // Projetos (TOP 10 + detalhes por status/severidade)
    // ============================================================
    const projectData = await Observation.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$project", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const projectStatusData = await Observation.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { project: "$project", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const projectSeverityData = await Observation.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { project: "$project", severity: "$severity" },
          count: { $sum: 1 },
        },
      },
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
    // Evolução (chartData)
    // ============================================================
    const days =
      range === "24h" ? 1 : range === "7d" ? 7 : range === "14d" ? 14 : 30;
    const dateFilter = { $gte: subDays(new Date(), days) };

    const evolutionSeverityData = await Observation.aggregate([
      { $match: { ...baseMatch, firstSeen: dateFilter } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
            severity: "$severity",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const evolutionStatusData = await Observation.aggregate([
      { $match: { ...baseMatch, firstSeen: dateFilter } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
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
