// app/api/teams/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { Team } from "@/models/Team";
import { Project } from "@/models/Project";
import { getServerSessionIds } from "@/lib/session-server";
import { handleGenericGet } from "@/lib/api-handler";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/api-auth";
import { toObjectId, toObjectIds } from "@/lib/mongo-id";
import * as Sentry from "@sentry/nextjs";

/**
 * Lista recursos do endpoint /api/teams.
 *
 * Este endpoint expõe a operação get em /api/teams.
 *
 * @summary Lista recursos do endpoint /api/teams
 * @tags Teams
 * @route GET /api/teams
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeGlobal = searchParams.get("includeGlobal") !== "false";
  const isAll = searchParams.get("all") === "true";

  const additionalMatch: Record<string, unknown> = {};
  if (!includeGlobal) {
    additionalMatch.isGlobal = { $ne: true };
  }

  // 🔑 projectCount agora é calculado via $lookup em Projects,
  //    usando a MESMA fonte que o DELETE valida (`Project.teamId`).
  //    Isso elimina a possibilidade de a coluna mostrar "0 projetos"
  //    enquanto o delete bloqueia com 409 por "projetos vinculados".
  const customPipeline: PipelineStage[] = [
    {
      $lookup: {
        from: Project.collection.name, // ← nome real da collection
        let: { teamId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$teamId", "$$teamId"] } } },
          { $count: "count" },
        ],
        as: "projectStats",
      },
    },
    {
      $addFields: {
        projectCount: {
          $ifNull: [{ $arrayElemAt: ["$projectStats.count", 0] }, 0],
        },
      },
    },
    {
      // Remove o array auxiliar para não pesar no payload
      $project: { projectStats: 0 },
    },
  ];

  return handleGenericGet(req, {
    model: Team,
    defaultSort: "createdAt",
    additionalMatch,
    customPipeline,
    all: isAll,
    projection: {
      _id: 1,
      name: 1,
      description: 1,
      projectIds: 1,
      tenantId: 1,
      isGlobal: 1,
      createdAt: 1,
      updatedAt: 1,
      projectCount: 1,
    },
  });
}

/**
 * Cria recurso do endpoint /api/teams.
 *
 * Este endpoint expõe a operação post em /api/teams.
 *
 * @summary Cria recurso do endpoint /api/teams
 * @tags Teams
 * @route POST /api/teams
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;
  const body = await req.json();
  const { name, description, projectIds = [], isGlobal } = body;

  // 🔥 Normaliza para array plano (achata se vier aninhado)
  const flatProjectIds = Array.isArray(projectIds) ? projectIds.flat() : [];

  // Converte para ObjectId e valida existência
  const validProjectIds = flatProjectIds
    .map((id) =>
      typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null,
    )
    .filter((id) => id !== null);

  const newTeam = await Team.create({
    name,
    description: description || "",
    projectIds: validProjectIds,
    tenantId,
    isGlobal: isGlobal || false,
  });

  // Atualiza apenas os projetos que realmente existem
  if (validProjectIds.length > 0) {
    await Project.updateMany(
      { _id: { $in: validProjectIds }, tenantId },
      { $set: { teamId: newTeam._id } },
    );
  }

  return NextResponse.json(newTeam, { status: 201 });
}

export const dynamic = "force-dynamic";

// ============================================================
// DELETE — single (?id=X) ou bulk (?ids=X,Y,Z)
// ============================================================
export async function DELETE(req: NextRequest) {
  try {
    // 🔒 Regra: apenas admin pode excluir times
    const auth = await requireAdmin();
    if (auth.ok === false) return auth.response;

    const tenantObjectId = toObjectId(auth.user.tenantId);
    if (!tenantObjectId) {
      return NextResponse.json({ error: "Tenant inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get("id");
    const idsParam = searchParams.get("ids");

    const ids = toObjectIds(singleId ?? idsParam);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 🔎 Regra de negócio: impede deletar times com projetos vinculados.
    //    Alternativa: cascade delete (descomente abaixo) — escolha uma.
    const teamsWithProjects = await Project.distinct("teamId", {
      tenantId: { $eq: tenantObjectId },
      teamId: { $in: ids },
    });

    if (teamsWithProjects.length > 0) {
      const blocked = ids.filter((id) =>
        teamsWithProjects.some((t) => String(t) === String(id)),
      );
      return NextResponse.json(
        {
          error:
            "Alguns times possuem projetos vinculados. Remova-os antes de excluir o time.",
          blockedTeamIds: blocked.map(String),
        },
        { status: 409 },
      );
    }

    // Cascade delete (opcional) — descomente se preferir apagar tudo junto:
    // await Project.deleteMany({
    //   tenantId: { $eq: tenantObjectId },
    //   teamId: { $in: ids },
    // });

    const result = await Team.deleteMany({
      _id: { $in: ids },
      tenantId: { $eq: tenantObjectId },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Erro ao excluir times" },
      { status: 500 },
    );
  }
}
