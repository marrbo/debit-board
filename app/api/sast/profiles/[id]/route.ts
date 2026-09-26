// app/api/sast/profiles/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { ScanProfile } from "@/models/ScanProfile";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Atualiza um perfil de scan existente do usuário autenticado.
 *
 * @summary Atualiza perfil de scan
 * @tags Sast, Profiles
 * @route PUT /api/sast/profiles/{id}
 * @async
 * @function PUT
 * @param {NextRequest} req - Corpo parcial: `{ name?, description?, patternIds? }`.
 * @param {RouteContext} context - Parâmetros da rota (`id`).
 * @returns {Promise<NextResponse>} Perfil atualizado ou erro.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const { id } = await context.params;
  const profileId = toObjectId(id);
  if (!profileId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body?.description === "string") {
    update.description = body.description.trim();
  }

  if (Array.isArray(body?.patternIds)) {
    if (body.patternIds.length === 0) {
      return NextResponse.json(
        { error: "Pelo menos um pattern é obrigatório." },
        { status: 400 },
      );
    }
    const validPatterns = await VulnerabilityPattern.find({
      _id: { $in: body.patternIds },
      enabled: true,
    })
      .select({ _id: 1 })
      .lean();

    if (validPatterns.length !== body.patternIds.length) {
      return NextResponse.json(
        { error: "Um ou mais patterns são inválidos." },
        { status: 400 },
      );
    }
    update.patternIds = validPatterns.map((p) => p._id);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar." },
      { status: 400 },
    );
  }

  try {
    const profile = await ScanProfile.findOneAndUpdate(
      { _id: profileId, sub: auth.user.sub },
      { $set: update },
      { new: true },
    ).lean();

    if (!profile) {
      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "Já existe um perfil com esse nome." },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * Remove um perfil de scan do usuário autenticado.
 *
 * @summary Remove perfil de scan
 * @tags Sast, Profiles
 * @route DELETE /api/sast/profiles/{id}
 * @async
 * @function DELETE
 * @param {NextRequest} _req - Requisição HTTP (não utilizada).
 * @param {RouteContext} context - Parâmetros da rota (`id`).
 * @returns {Promise<NextResponse>} Confirmação da exclusão.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const { id } = await context.params;
  const profileId = toObjectId(id);
  if (!profileId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const result = await ScanProfile.deleteOne({
    _id: profileId,
    sub: auth.user.sub,
  });

  if (!result.deletedCount) {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
