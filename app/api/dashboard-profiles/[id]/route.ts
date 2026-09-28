// app/api/dashboard-profiles/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { DashboardProfile } from "@/models/DashboardProfile";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import type {
  DashboardProfileKind,
  DashboardProfileVisibility,
  IDashboardWidgetRef,
} from "@/types/IDashboardProfile";

type RouteContext = { params: Promise<{ id: string }> };

const KINDS: DashboardProfileKind[] = ["dashboard", "tv"];
const VISIBILITIES: DashboardProfileVisibility[] = [
  "private",
  "shared",
  "public",
];

function normalizeLayout(raw: unknown): IDashboardWidgetRef[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IDashboardWidgetRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (typeof o.widgetId !== "string") return null;
    if (typeof o.visible !== "boolean") return null;
    if (typeof o.order !== "number") return null;
    const span = o.span;
    if (span !== 2 && span !== 3 && span !== 4 && span !== 6) return null;
    out.push({
      widgetId: o.widgetId,
      visible: o.visible,
      order: o.order,
      span,
    });
  }
  return out;
}

/**
 * @openapi
 * /api/dashboard-profiles/{id}:
 *   put:
 *     summary: Atualiza um perfil de dashboard
 *     description: |
 *       Apenas o **dono** (mesmo `tenantId` + `sub`) pode editar.
 *       Campos ausentes são preservados. Quando `kind === "tv"` e
 *       `cycleTeams === true`, `tv.teamId` é forçado a `null`.
 *     tags: [Dashboard Profiles]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DashboardProfileInput' }
 *     responses:
 *       200:
 *         description: Perfil atualizado.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DashboardProfile' }
 *       400: { description: Payload inválido. }
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       404: { description: Perfil não encontrado. }
 *       409: { description: Nome já em uso. }
 *       423:
 *         description: Usuário sem tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const profileId = toObjectId(id);
  if (!profileId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const tenantId = toObjectId(auth.user.tenantId);
  const sub = auth.user.sub;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (
    typeof body.kind === "string" &&
    KINDS.includes(body.kind as DashboardProfileKind)
  ) {
    update.kind = body.kind;
  }
  if (
    typeof body.visibility === "string" &&
    VISIBILITIES.includes(body.visibility as DashboardProfileVisibility)
  ) {
    update.visibility = body.visibility;
  }
  if (body.layout !== undefined) {
    const layout = normalizeLayout(body.layout);
    if (!layout) {
      return NextResponse.json({ error: "Layout inválido." }, { status: 400 });
    }
    update.layout = layout;
  }

  if (body.tv !== undefined) {
    const raw = (body.tv ?? {}) as Record<string, unknown>;
    const cycleTeams = raw.cycleTeams === true;
    const teamId = cycleTeams
      ? null
      : toObjectId(typeof raw.teamId === "string" ? raw.teamId : null);
    update.tv = {
      teamId,
      refreshSec:
        typeof raw.refreshSec === "number" && raw.refreshSec >= 0
          ? Math.floor(raw.refreshSec)
          : 60,
      cycleTeams,
    };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar." },
      { status: 400 },
    );
  }

  try {
    const updated = await DashboardProfile.findOneAndUpdate(
      {
        _id: profileId,
        tenantId: { $eq: tenantId },
        sub: { $eq: sub },
      },
      { $set: update },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
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
 * @openapi
 * /api/dashboard-profiles/{id}:
 *   delete:
 *     summary: Remove um perfil de dashboard
 *     description: Apenas o **dono** pode remover.
 *     tags: [Dashboard Profiles]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Perfil removido.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *       400: { description: ID inválido. }
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
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  const profileId = toObjectId(id);
  if (!profileId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const result = await DashboardProfile.deleteOne({
    _id: profileId,
    tenantId: { $eq: toObjectId(auth.user.tenantId) },
    sub: { $eq: auth.user.sub },
  });

  if (!result.deletedCount) {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
