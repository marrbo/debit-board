// app/api/dashboard/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Observation } from "@/models/Observation";
import { Team } from "@/models/Team";
import { SavedQuery } from "@/models/SavedQuery";
import { parseDBQL } from "@/lib/parseDBQL";
import mongoose from "mongoose";
import { normalizeProjectIds } from "@/lib/serverUtils";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
/**
 * Lista recursos do endpoint /api/dashboard.
 *
 * Este endpoint expõe a operação get em /api/dashboard.
 *
 * @summary Lista recursos do endpoint /api/dashboard
 * @tags Dashboard
 * @route GET /api/dashboard
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const sortField = searchParams.get("sort") || "createdAt";
  const sortOrder = searchParams.get("order") === "asc" ? 1 : -1;
  const dbqlId = searchParams.get("q");
  const searchQueryRaw = searchParams.get("search") || "";
  const isAll = searchParams.get("all") === "true";

  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch (error) {
      console.error("Erro ao buscar SavedQuery:", error);
    }
  }

  // 🔥 Lógica para achar os IDs de Projetos permitidos
  let allowedProjectIds: mongoose.Types.ObjectId[] | null = null;

  if (teamId && teamId !== "all") {
    const teamObjectId = mongoose.Types.ObjectId.isValid(teamId)
      ? new mongoose.Types.ObjectId(teamId)
      : null;

    const team = await Team.findById(teamObjectId).lean();
    if (!team) {
      return NextResponse.json({
        data: [],
        total: 0,
        message: "Time não encontrado",
      });
    }

    // 🔥 Normaliza projectIds (achatamento + validação)
    allowedProjectIds = normalizeProjectIds(team.projectIds);

    // 🔥 Log para diagnóstico
    console.log(
      `[Dashboard] Time: ${team.name}, projectIds normalizados: ${allowedProjectIds.length}`,
    );
  }

  // Se houver DBQL, filtra pelos nomes de projetos que batem com a query
  if (finalSearchQuery) {
    const parsedMatch = parseDBQL(finalSearchQuery);
    if (parsedMatch && Object.keys(parsedMatch).length > 0) {
      const obsMatch: any = { tenantId };

      // Intersecta com os projetos do time, se existir
      if (allowedProjectIds) {
        const teamProjects = await Project.find({
          _id: { $in: allowedProjectIds },
        })
          .select("name")
          .lean();
        obsMatch.project = { $in: teamProjects.map((p) => p.name) };
      }

      Object.assign(obsMatch, parsedMatch);
      const matchedProjectNames = await Observation.distinct(
        "project",
        obsMatch,
      );

      const matchedProjects = await Project.find({
        name: { $in: matchedProjectNames },
      })
        .select("_id")
        .lean();

      if (allowedProjectIds) {
        const matchedIds = matchedProjects.map((p) => p._id);
        // Intersecção
        allowedProjectIds = allowedProjectIds.filter((id) =>
          matchedIds.some((mid) => mid.equals(id)),
        );
      } else {
        allowedProjectIds = matchedProjects.map((p) => p._id);
      }
    }
  }

  // 🔥 Busca os Projetos com paginação
  const filter: any = { tenantId };
  if (allowedProjectIds && allowedProjectIds.length > 0) {
    filter._id = { $in: allowedProjectIds };
  }

  try {
    // 🔥 Se all=true, ignora paginação e retorna todos
    const skip = isAll ? 0 : (page - 1) * limit;
    const effectiveLimit = isAll ? 100000 : limit; // Use um número alto para garantir todos

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(effectiveLimit)
        .lean(),
      Project.countDocuments(filter),
    ]);

    return NextResponse.json({ data: projects, total });
  } catch (error: any) {
    console.error("Erro ao buscar projetos:", error);
    return NextResponse.json(
      { data: [], total: 0, error: error.message },
      { status: 500 },
    );
  }
}
