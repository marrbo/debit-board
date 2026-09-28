// app/api/dashboard-profiles/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { DashboardProfile } from "@/models/DashboardProfile";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import type {
  DashboardProfileKind,
  DashboardProfileVisibility,
  IDashboardWidgetRef,
} from "@/types/IDashboardProfile";

export const dynamic = "force-dynamic";

const KINDS: DashboardProfileKind[] = ["dashboard", "tv"];
const VISIBILITIES: DashboardProfileVisibility[] = [
  "private",
  "shared",
  "public",
];

/**
 * Valida e normaliza o array de widgets enviado no body.
 * Retorna `null` se algo estiver no formato errado.
 */
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
 * /api/dashboard-profiles:
 *   get:
 *     summary: Lista perfis de dashboard visíveis ao usuário
 *     description: |
 *       Retorna perfis visíveis (public + shared do tenant + private do
 *       usuário), com filtros opcionais.
 *
 *       **Ordenação:** perfis favoritados pelo usuário vêm primeiro,
 *       seguidos por ordem de criação decrescente.
 *     tags: [Dashboard Profiles]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [dashboard, tv] }
 *         description: Filtra por tipo.
 *       - in: query
 *         name: favorite
 *         schema: { type: boolean }
 *         description: Quando `true`, retorna apenas favoritos.
 *     responses:
 *       200:
 *         description: Lista de perfis.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DashboardProfileListResponse' }
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       423:
 *         description: Usuário sem tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  const sub = auth.user.sub;
  const { searchParams } = new URL(req.url);

  const kindParam = searchParams.get("kind");
  const kind =
    kindParam === "tv" || kindParam === "dashboard" ? kindParam : null;
  const onlyFavorite = searchParams.get("favorite") === "true";

  const docs = await DashboardProfile.findVisible(tenantId, sub);

  let filtered = docs;
  if (kind) filtered = filtered.filter((p) => p.kind === kind);
  if (onlyFavorite) {
    filtered = filtered.filter((p) => p.favorites.includes(sub));
  }

  // Favoritos primeiro, depois por data de criação desc
  filtered.sort((a, b) => {
    const aFav = a.favorites.includes(sub) ? 0 : 1;
    const bFav = b.favorites.includes(sub) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return NextResponse.json({ data: filtered, total: filtered.length });
}

/**
 * @openapi
 * /api/dashboard-profiles:
 *   post:
 *     summary: Cria um perfil de dashboard
 *     description: |
 *       Cria um novo perfil. Nome precisa ser único dentro do escopo
 *       `(tenantId, sub)`.
 *
 *       **Regras de TV:**
 *       - `kind === "tv"` requer bloco `tv` com `refreshSec` e
 *         `cycleTeams`.
 *       - Quando `cycleTeams === true`, o campo `tv.teamId` é
 *         **forçado a `null`** no servidor — a UI deve desabilitar o
 *         seletor de time nesse modo.
 *     tags: [Dashboard Profiles]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DashboardProfileInput' }
 *     responses:
 *       201:
 *         description: Perfil criado.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DashboardProfile' }
 *       400:
 *         description: Payload inválido.
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       409:
 *         description: Já existe um perfil com esse nome.
 *       423:
 *         description: Usuário sem tenant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  const sub = auth.user.sub;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = KINDS.includes(body.kind as DashboardProfileKind)
    ? (body.kind as DashboardProfileKind)
    : null;
  const visibility = VISIBILITIES.includes(
    body.visibility as DashboardProfileVisibility,
  )
    ? (body.visibility as DashboardProfileVisibility)
    : "private";

  if (!name || !kind) {
    return NextResponse.json(
      { error: "Nome e tipo são obrigatórios." },
      { status: 400 },
    );
  }

  const layout = normalizeLayout(body.layout);
  if (!layout) {
    return NextResponse.json({ error: "Layout inválido." }, { status: 400 });
  }

  let tv: Record<string, unknown> | undefined;
  if (kind === "tv") {
    const raw = (body.tv ?? {}) as Record<string, unknown>;
    const refreshSec =
      typeof raw.refreshSec === "number" && raw.refreshSec >= 0
        ? Math.floor(raw.refreshSec)
        : 60;
    const cycleTeams = raw.cycleTeams === true;
    const teamId = cycleTeams
      ? null
      : toObjectId(typeof raw.teamId === "string" ? raw.teamId : null);
    tv = { teamId, refreshSec, cycleTeams };
  }

  const user = await User.findBySub(sub);
  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 500 },
    );
  }

  try {
    const created = await DashboardProfile.create({
      name,
      kind,
      visibility,
      tenantId,
      userId: user._id,
      sub,
      layout,
      tv,
      favorites: [],
    });
    return NextResponse.json(created, { status: 201 });
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
