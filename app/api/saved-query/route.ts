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
/**
 * @openapi
 * /api/saved-query:
 *   get:
 *     summary: Lista consultas DBQL salvas visíveis ao usuário
 *     description: |
 *       Retorna as `SavedQuery` visíveis ao usuário autenticado, com
 *       filtros opcionais e paginação.
 *
 *       **Modos de uso:**
 *
 *       - **`?id=<ObjectId>`** — busca uma única query pelo `_id`. Ignora
 *         paginação e demais filtros. Retorna 404 se a query não existir
 *         ou não for visível ao usuário.
 *       - **`?q=<ObjectId>`** — resolve uma query por ID e usa seu
 *         `queryString` como filtro de busca textual. Útil para o
 *         `DBQLAdvancedSearch` reaproveitar uma query salva.
 *       - **`?search=<texto>`** — busca textual no campo `queryString`
 *         (aplicada se `?q=` não foi informado).
 *       - **`?visibility=<enum>`** — restringe ao tipo indicado
 *         (`public`, `shared`, `private`, `temporary`). Se o usuário não
 *         pode ver o tipo, retorna lista vazia sem tocar o banco.
 *       - **`?context=<enum>`** — filtra por contexto
 *         (`observations`, `projects`, `repositories`, `stats`).
 *       - **`?page` / `?limit`** — paginação (default `1` / `10`).
 *
 *       **Regras de visibilidade** (aplicadas como `$or`):
 *
 *       | Tipo | Requisito |
 *       |---|---|
 *       | `public` | Qualquer tenant |
 *       | `shared` | Mesmo tenant |
 *       | `private` | Mesmo tenant **e** mesmo usuário |
 *       | `temporary` | Mesmo tenant **e** mesmo usuário |
 *
 *       Quando `?id=` é informado, o endpoint **não aplica paginação** e
 *       devolve o objeto direto (sem envelope `{ data, total, ... }`).
 *     tags:
 *       - Saved Query
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema: { type: string }
 *         description: ObjectId de uma query específica. Quando presente, ignora paginação.
 *         example: 6a9ac08f7c1cd60351d1a818
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: ObjectId de uma SavedQuery usada para resolver o `search` a partir do `queryString`.
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Texto livre para filtrar no `queryString`.
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [public, shared, private, temporary]
 *         description: Restringe o resultado a um único tipo de visibilidade.
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [observations, projects, repositories, stats]
 *         description: Filtra pelo contexto da query.
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 10 }
 *     responses:
 *       200:
 *         description: |
 *           Lista paginada de queries (envelope `{ data, total, page, limit, totalPages }`)
 *           ou objeto único quando `?id=` foi informado.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SavedQuery'
 *                 - $ref: '#/components/schemas/PaginatedSavedQueries'
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Query não encontrada quando `?id=` foi informado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 */
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
 * @openapi
 * /api/saved-query:
 *   post:
 *     summary: Cria uma nova consulta DBQL salva
 *     description: |
 *       Cria uma `SavedQuery` no tenant do usuário autenticado.
 *
 *       **Fluxo especial para `temporary`:** se já existir uma query
 *       temporária do usuário (identificada por `tenantId + sub` +
 *       `visibility: "temporary"`), ela é **atualizada** em vez de criar
 *       uma nova — a plataforma mantém no máximo **uma** temporary por
 *       usuário. O `status` da resposta é `201` em ambos os casos.
 *
 *       **Backfill defensivo:** o `userId` (ObjectId do `User`) é
 *       resolvido via `User.findBySub()` e sobrescrito no documento.
 *       Isso corrige dados legados que possam não ter esse campo.
 *     tags:
 *       - Saved Query
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, queryString]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome legível da consulta.
 *                 example: AllowAnonymous - GERAL
 *               queryString:
 *                 type: string
 *                 description: Consulta DBQL em `propriedade:valor`.
 *                 example: 'category:"Broken Access Control" AND status:open'
 *               context:
 *                 type: string
 *                 enum: [observations, projects, repositories, stats]
 *                 default: observations
 *               visibility:
 *                 type: string
 *                 enum: [private, shared, public, temporary]
 *                 default: private
 *     responses:
 *       201:
 *         description: Query criada ou atualizada (temporary).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavedQuery'
 *       400:
 *         description: Campos obrigatórios ausentes (`name` ou `queryString`).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             example:
 *               error: Nome e Query são obrigatórios
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: "Erro interno ao salvar (ex.: usuário não encontrado)."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             example:
 *               error: Erro ao salvar query
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
 * @openapi
 * /api/saved-query:
 *   put:
 *     summary: Atualiza uma consulta DBQL salva
 *     description: |
 *       Atualiza campos de uma `SavedQuery` existente. Apenas o **dono**
 *       (mesmo `tenantId` **e** mesmo `sub`) pode editar — admin que
 *       precisar editar a query de outro usuário deve primeiro
 *       **impersonar** o dono.
 *
 *       Apenas os campos enviados no body são alterados. Campos com
 *       valores inválidos ou ausentes são ignorados.
 *
 *       **Retorno 404 mascarado:** quando o `id` existe mas pertence a
 *       outro usuário, o endpoint devolve **404** (não 403) para não
 *       vazar a existência do recurso.
 *     tags:
 *       - Saved Query
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: string
 *                 description: ObjectId da SavedQuery.
 *               name: { type: string }
 *               queryString: { type: string }
 *               context:
 *                 type: string
 *                 enum: [observations, projects, repositories, stats]
 *               visibility:
 *                 type: string
 *                 enum: [private, shared, public, temporary]
 *           examples:
 *             renameOnly:
 *               summary: Apenas renomear
 *               value: { id: "6a9ac08f...", name: "Novo nome" }
 *             changeQuery:
 *               summary: Alterar a query
 *               value:
 *                 id: "6a9ac08f..."
 *                 queryString: 'severity:critical AND status:open'
 *     responses:
 *       200:
 *         description: Query atualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavedQuery'
 *       400:
 *         description: ID inválido ou nenhum campo válido para atualizar.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Query não encontrada ou pertence a outro usuário.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: Erro interno ao atualizar.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
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
 * @openapi
 * /api/saved-query:
 *   delete:
 *     summary: Remove uma ou várias consultas DBQL salvas
 *     description: |
 *       Remove `SavedQuery` por `id` único (`?id=`) ou em lote
 *       (`?ids=id1,id2,...`). Apenas queries **do próprio usuário**
 *       (mesmo `tenantId` **e** mesmo `sub`) são removidas.
 *
 *       IDs de outros usuários são **silenciosamente ignorados** — o
 *       endpoint retorna o número de documentos efetivamente deletados
 *       em `deleted`, sem erro para os que não casaram.
 *
 *       **Idempotente:** chamar com um `id` já inexistente devolve
 *       `{ success: true, deleted: 0 }`.
 *     tags:
 *       - Saved Query
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema: { type: string }
 *         description: ID único para deletar.
 *         example: 6a9ac08f7c1cd60351d1a818
 *       - in: query
 *         name: ids
 *         schema: { type: string }
 *         description: Lista de IDs separados por vírgula.
 *         example: 6a9ac08f...,6a9ac09f...
 *     responses:
 *       200:
 *         description: Resultado da operação.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, deleted]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 deleted:
 *                   type: integer
 *                   description: Número de documentos efetivamente removidos.
 *                   example: 2
 *       400:
 *         description: Nenhum ID válido informado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             example:
 *               error: ID inválido
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
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
