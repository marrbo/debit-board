// app/api/saved-query/route.ts
import { handleGenericGet } from "@/lib/api-handler";
import { SavedQuery } from "@/models/SavedQuery";
import { NextResponse, type NextRequest } from "next/server";
import { toObjectId, toObjectIds } from "@/lib/mongo-id";
import { toNonEmptyString, toStringEnum } from "@/lib/validators";
import type {
  SavedQueryContext,
  SavedQueryVisibility,
} from "@/types/ISavedQuery";
import { requireSession } from "@/lib/api-auth";
import type { Types } from "mongoose";
import { User } from "@/models/User";
import * as Sentry from "@sentry/node";

export const dynamic = "force-dynamic";

const CONTEXTS = [
  "observations",
  "projects",
  "repositories",
  "stats",
] as const satisfies readonly SavedQueryContext[];

const VISIBILITIES = [
  "private",
  "shared",
  "public",
  "temporary",
] as const satisfies readonly SavedQueryVisibility[];

// ============================================================
// Regras de visibilidade
// ============================================================
/**
 * Constrói as condições `$or` que definem o que o usuário autenticado
 * pode ver:
 *
 *  - `public`    → qualquer tenant
 *  - `shared`    → mesmo tenant
 *  - `private`   → mesmo tenant E mesmo `sub` (usuário)
 *  - `temporary` → mesmo tenant E mesmo `sub` (usuário)
 *
 * Se o `tenantId` for inválido, só `public` é retornado. Se o `sub` for
 * inválido, `private`/`temporary` são omitidos.
 */
function buildVisibilityConditions(
  tenantObjectId: Types.ObjectId | undefined,
  userSub: string | undefined,
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [
    { visibility: { $eq: "public" } },
  ];

  if (tenantObjectId) {
    conditions.push({
      visibility: { $eq: "shared" },
      tenantId: { $eq: tenantObjectId },
    });

    if (userSub) {
      conditions.push({
        visibility: { $eq: "private" },
        tenantId: { $eq: tenantObjectId },
        sub: { $eq: userSub },
      });
      conditions.push({
        visibility: { $eq: "temporary" },
        tenantId: { $eq: tenantObjectId },
        sub: { $eq: userSub },
      });
    }
  }

  return conditions;
}

// ============================================================
// GET
// ============================================================
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantObjectId = toObjectId(auth.user.tenantId);
  const userSub = auth.user.sub;
  const { searchParams } = new URL(req.url);

  // Todas as condições de visibilidade que o usuário pode acessar
  const visibleConditions = buildVisibilityConditions(tenantObjectId, userSub);

  // ------ Busca por ID único ------
  const idParam = toObjectId(searchParams.get("id"));
  if (idParam) {
    const savedQuery = await SavedQuery.findOne({
      _id: { $eq: idParam },
      $or: visibleConditions,
    }).lean();

    if (!savedQuery) {
      return NextResponse.json(
        { error: "Consulta não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(savedQuery);
  }

  // ------ Resolve DBQL (id de saved query referenciado em `?q=`) ------
  const searchQueryRaw = searchParams.get("search") ?? "";
  let finalSearchQuery = searchQueryRaw;

  const dbqlId = toObjectId(searchParams.get("q"));
  if (dbqlId) {
    // Só permite referenciar saved-queries visíveis ao usuário atual
    const savedQuery = await SavedQuery.findOne({
      _id: { $eq: dbqlId },
      $or: visibleConditions,
    }).lean();
    if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
  }

  // ------ Filtro opcional por visibility ------
  // Se o usuário pedir visibility=X, restringimos o $or só às condições
  // que permitem X. Se ele pedir algo que não pode ver (ex.: private de
  // outro), retornamos vazio sem tocar o banco.
  const visibilityParam = toStringEnum(
    searchParams.get("visibility"),
    VISIBILITIES,
  );

  const filteredConditions = visibilityParam
    ? visibleConditions.filter((cond) => {
        const v = cond.visibility as { $eq: SavedQueryVisibility };
        return v.$eq === visibilityParam;
      })
    : visibleConditions;

  if (filteredConditions.length === 0) {
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    return NextResponse.json({
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    });
  }

  // ------ Monta additionalMatch ------
  const additionalMatch: Record<string, unknown> = {
    $or: filteredConditions,
  };

  const context = toStringEnum(searchParams.get("context"), CONTEXTS);
  if (context) additionalMatch.context = { $eq: context };

  // ------ Delega ao handler genérico ------
  // 🔑 skipTenantFilter: true → não adiciona `tenantId: <atual>` no $match,
  //    porque a visibilidade cross-tenant já é tratada pelo $or acima.
  return handleGenericGet(req, {
    model: SavedQuery,
    defaultSort: "createdAt",
    additionalMatch,
    overrideSearchQuery: finalSearchQuery,
    skipTenantFilter: true,
    projection: {
      _id: 1,
      name: 1,
      queryString: 1,
      context: 1,
      visibility: 1,
      sub: 1,
      userId: 1,
      createdAt: 1,
    },
  });
}

// ============================================================
// POST
// ============================================================
/**
 * Cria recurso do endpoint /api/saved-query.
 *
 * Este endpoint expõe a operação post em /api/saved-query.
 *
 * @summary Cria recurso do endpoint /api/saved-query
 * @tags Saved Query
 * @route POST /api/saved-query
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    const userSub = auth.user.sub;
    const tenantObjectId = toObjectId(auth.user.tenantId);
    const body = (await req.json()) as Record<string, unknown>;

    const name = toNonEmptyString(body.name);
    const queryString = toNonEmptyString(body.queryString);
    if (!name || !queryString) {
      return NextResponse.json(
        { error: "Nome e Query são obrigatórios" },
        { status: 400 },
      );
    }

    const context = toStringEnum(body.context, CONTEXTS) ?? "observations";
    const visibility = toStringEnum(body.visibility, VISIBILITIES) ?? "private";

    // 🔑 Busca o usuário UMA vez, antes dos dois ramos (update/criação)
    const user = await User.findBySub(userSub);
    if (!user) throw new Error("[Saved-queries] ON Save: User Not Found");

    // Reaproveita a temporária do usuário, se existir
    const tempQuery = await SavedQuery.findTemporary(
      tenantObjectId.toString(),
      userSub,
    );

    if (tempQuery || body.visibility === "temporary") {
      // findOneAndUpdate NÃO revalida o documento inteiro, só os campos
      // que você tocar. Assim, dados legados sem `userId` não derrubam o save.
      const updated = await SavedQuery.findOneAndUpdate(
        { _id: tempQuery._id },
        {
          $set: {
            name,
            queryString,
            context,
            visibility,
            // backfill defensivo — se o doc é legado, preenche agora
            userId: user._id,
            sub: userSub,
          },
        },
        { new: true },
      );

      return NextResponse.json(updated, { status: 201 });
    }

    const created = await SavedQuery.create({
      name,
      queryString,
      context,
      visibility,
      tenantId: tenantObjectId,
      sub: userSub,
      userId: user._id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Erro ao salvar query" },
      { status: 500 },
    );
  }
}

// ============================================================
// PUT
// ============================================================
/**
 * Atualiza recurso do endpoint /api/saved-query.
 *
 * Este endpoint expõe a operação put em /api/saved-query.
 *
 * @summary Atualiza recurso do endpoint /api/saved-query
 * @tags Saved Query
 * @route PUT /api/saved-query
 * @async
 * @function PUT
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSession();
    if (auth.ok === false) return auth.response;

    const tenantObjectId = toObjectId(auth.user.tenantId);
    const userSub = auth.user.sub;

    const body = (await req.json()) as Record<string, unknown>;
    const id = toObjectId(body.id);
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // $set construído explicitamente — só campos permitidos
    const updateData: Record<string, unknown> = {};

    const name = toNonEmptyString(body.name);
    if (name) updateData.name = name;

    const queryString = toNonEmptyString(body.queryString);
    if (queryString) updateData.queryString = queryString;

    const context = toStringEnum(body.context, CONTEXTS);
    if (context) updateData.context = context;

    const visibility = toStringEnum(body.visibility, VISIBILITIES);
    if (visibility) updateData.visibility = visibility;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualizar" },
        { status: 400 },
      );
    }

    // 🔒 tenantId + sub: só o dono pode editar.
    // Admin que quiser editar outra query precisa impersonar o dono.
    const updatedQuery = await SavedQuery.findOneAndUpdate(
      {
        _id: { $eq: id },
        tenantId: { $eq: tenantObjectId },
        sub: { $eq: userSub },
      },
      { $set: updateData },
      { new: true },
    );

    if (!updatedQuery) {
      // 404 para não vazar a existência de recursos de outros usuários
      return NextResponse.json(
        { error: "Consulta não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(updatedQuery);
  } catch (error) {
    console.error("Erro ao atualizar query:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar query" },
      { status: 500 },
    );
  }
}

// ============================================================
// DELETE
// ============================================================
/**
 * Remove recurso do endpoint /api/saved-query.
 *
 * Este endpoint expõe a operação delete em /api/saved-query.
 *
 * @summary Remove recurso do endpoint /api/saved-query
 * @tags Saved Query
 * @route DELETE /api/saved-query
 * @async
 * @function DELETE
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantObjectId = toObjectId(auth.user.tenantId);
  const userSub = auth.user.sub;

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");
  const idsParam = searchParams.get("ids");

  const ids = toObjectIds(singleId ?? idsParam);
  if (ids.length === 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // 🔒 Só apaga as que pertencem ao próprio usuário
  const result = await SavedQuery.deleteMany({
    _id: { $in: ids },
    tenantId: { $eq: tenantObjectId },
    sub: { $eq: userSub },
  });

  return NextResponse.json({
    success: true,
    deleted: result.deletedCount,
  });
}
