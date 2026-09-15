import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Team } from "@/models/Team";
import { Project } from "@/models/Project";
import { getServerSessionIds } from "@/lib/session-server";
import { toObjectId, toObjectIds } from "@/lib/mongo-id";
import { toNonEmptyString } from "@/lib/validators";

// ============================================================
// Helpers locais
// ============================================================
function parseIdParam(id: string | undefined) {
  return toObjectId(id);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ============================================================
// PUT
// ============================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionIds = await getServerSessionIds();
  const tenantObjectId = toObjectId(sessionIds.tenantId);
  if (!tenantObjectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { id } = await params;
  const teamObjectId = parseIdParam(id);
  if (!teamObjectId) {
    return NextResponse.json(
      { error: "ID de team inválido" },
      { status: 400 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;

  const name = toNonEmptyString(body.name);
  const description = toOptionalString(body.description);
  const hasProjectIds = body.projectIds !== undefined;
  const incomingProjectIds = hasProjectIds
    ? toObjectIds(body.projectIds)
    : undefined;

  // ============================================================
  // Transação — consistência entre Team e Project
  // ============================================================
  const dbSession = await Team.startSession();

  try {
    let result: unknown = null;

    await dbSession.withTransaction(async () => {
      const team = await Team.findOne({
        _id: { $eq: teamObjectId },
        tenantId: { $eq: tenantObjectId },
      }).session(dbSession);

      if (!team) {
        throw new NotFoundError("Team não encontrado");
      }

      // ============================================================
      // Reconciliação de projectIds
      // ============================================================
      if (incomingProjectIds !== undefined) {
        const existingProjects = await Project.find({
          _id: { $in: incomingProjectIds },
          tenantId: { $eq: tenantObjectId },
        })
          .select("_id")
          .session(dbSession)
          .lean();

        const allowedIds = new Set(existingProjects.map((p) => String(p._id)));
        const finalProjectIds = incomingProjectIds.filter((pid) =>
          allowedIds.has(String(pid)),
        );

        const currentIds = new Set(team.projectIds.map((pid) => String(pid)));
        const finalIds = new Set(finalProjectIds.map((pid) => String(pid)));

        const toRemove = team.projectIds.filter(
          (pid) => !finalIds.has(String(pid)),
        );
        const toAdd = finalProjectIds.filter(
          (pid) => !currentIds.has(String(pid)),
        );

        if (toRemove.length > 0) {
          await Project.updateMany(
            {
              _id: { $in: toRemove },
              tenantId: { $eq: tenantObjectId },
            },
            { $unset: { teamId: 1 } },
            { session: dbSession },
          );
        }

        if (toAdd.length > 0) {
          await Project.updateMany(
            {
              _id: { $in: toAdd },
              tenantId: { $eq: tenantObjectId },
            },
            { $set: { teamId: team._id } },
            { session: dbSession },
          );
        }

        team.projectIds = finalProjectIds;
      }

      if (name) team.name = name;
      if (description !== undefined) team.description = description;

      await team.save({ session: dbSession });

      result = team.toObject();
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Erro ao atualizar team:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar team" },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }
}

// ============================================================
// DELETE
// ============================================================
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionIds = await getServerSessionIds();
  const tenantObjectId = toObjectId(sessionIds.tenantId);
  if (!tenantObjectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { id } = await params;
  const teamObjectId = parseIdParam(id);
  if (!teamObjectId) {
    return NextResponse.json(
      { error: "ID de team inválido" },
      { status: 400 },
    );
  }

  // ============================================================
  // Transação — desvincular projetos + deletar team
  // ============================================================
  const dbSession = await Team.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const team = await Team.findOne({
        _id: { $eq: teamObjectId },
        tenantId: { $eq: tenantObjectId },
      }).session(dbSession);

      if (!team) {
        throw new NotFoundError("Team não encontrado");
      }

      await Project.updateMany(
        {
          teamId: { $eq: team._id },
          tenantId: { $eq: tenantObjectId },
        },
        { $unset: { teamId: 1 } },
        { session: dbSession },
      );

      await team.deleteOne({ session: dbSession });
    });

    return NextResponse.json({ message: "Team deletado" });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Erro ao deletar team:", error);
    return NextResponse.json(
      { error: "Erro ao deletar team" },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }
}

// ============================================================
// Erro de domínio — permite distinguir 404 de 500 sem checar string
// ============================================================
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}