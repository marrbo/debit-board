// app/api/dashboard-profiles/[id]/favorite/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { DashboardProfile } from "@/models/DashboardProfile";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * @openapi
 * /api/dashboard-profiles/{id}/favorite:
 *   put:
 *     summary: Alterna o estado de favorito do perfil para o usuário
 *     description: |
 *       Adiciona o `sub` do usuário ao array `favorites` se ainda não
 *       estiver, remove se já estiver. Idempotente do ponto de vista do
 *       cliente: o resultado é sempre o mesmo estado final para o mesmo
 *       estado inicial.
 *
 *       **Visibilidade:** o usuário pode favoritar qualquer perfil
 *       visível a ele (inclui public e shared do tenant).
 *     tags: [Dashboard Profiles]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estado atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [favorited]
 *               properties:
 *                 favorited: { type: boolean }
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404: { description: Perfil não encontrado. }
 *       423:
 *         description: Usuário sem tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
export async function PUT(_req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const profileId = toObjectId(id);
  if (!profileId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const sub = auth.user.sub;
  const tenantId = toObjectId(auth.user.tenantId);

  // Confirma visibilidade antes de mexer nos favoritos
  const visible = await DashboardProfile.findOne({
    _id: profileId,
    $or: [
      { visibility: "public" },
      { visibility: "shared", tenantId: { $eq: tenantId } },
      {
        visibility: "private",
        tenantId: { $eq: tenantId },
        sub: { $eq: sub },
      },
    ],
  }).lean();

  if (!visible) {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 },
    );
  }

  const alreadyFavorited = visible.favorites.includes(sub);

  const updated = await DashboardProfile.findByIdAndUpdate(
    profileId,
    alreadyFavorited
      ? { $pull: { favorites: sub } }
      : { $addToSet: { favorites: sub } },
    { new: true },
  ).lean();

  return NextResponse.json({
    favorited: !alreadyFavorited,
    profile: updated,
  });
}
