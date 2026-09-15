// app/api/saved-query/route.ts
import { handleGenericGet } from "@/lib/api-handler";
import { getServerSessionIds } from "@/lib/session-server";
import { SavedQuery } from "@/models/SavedQuery";
import { NextResponse, type NextRequest } from "next/server";
import { toObjectId, toObjectIds } from "@/lib/mongo-id";
import { toNonEmptyString, toStringEnum } from "@/lib/validators";
import type {
  SavedQueryContext,
  SavedQueryVisibility,
} from "@/types/ISavedQuery";

export const dynamic = "force-dynamic";

// ============================================================
// Constantes — fonte única para validação
// ============================================================
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
// GET
// ============================================================
export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantObjectId = toObjectId(sessionIds.tenantId);
  if (!tenantObjectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Busca por ID único — cast + $eq em ambas as chaves
  const idParam = toObjectId(searchParams.get("id"));
  if (idParam) {
    const savedQuery = await SavedQuery.findOne({
      _id: { $eq: idParam },
      tenantId: { $eq: tenantObjectId },
    }).lean();

    if (!savedQuery) {
      return NextResponse.json(
        { error: "Consulta não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(savedQuery);
  }

  // Resolve DBQL (id de saved query referenciado em `?q=`)
  const searchQueryRaw = searchParams.get("search") ?? "";
  let finalSearchQuery = searchQueryRaw;

  const dbqlId = toObjectId(searchParams.get("q"));
  if (dbqlId) {
    const savedQuery = await SavedQuery.findOne({
      _id: { $eq: dbqlId },
      tenantId: { $eq: tenantObjectId },
    }).lean();
    if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
  }

  // Filtros opcionais — strings validadas por enum
  const additionalMatch: Record<string, unknown> = {};

  const context = toStringEnum(searchParams.get("context"), CONTEXTS);
  if (context) additionalMatch.context = { $eq: context };

  const visibility = toStringEnum(
    searchParams.get("visibility"),
    VISIBILITIES,
  );
  if (visibility) additionalMatch.visibility = { $eq: visibility };

  return handleGenericGet(req, {
    model: SavedQuery,
    defaultSort: "createdAt",
    additionalMatch,
    overrideSearchQuery: finalSearchQuery,
    projection: {
      _id: 1,
      name: 1,
      queryString: 1,
      context: 1,
      visibility: 1,
      createdAt: 1,
    },
  });
}

// ============================================================
// POST
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const sessionIds = await getServerSessionIds();
    const tenantObjectId = toObjectId(sessionIds.tenantId);
    const userObjectId = toObjectId(sessionIds.userId);

    if (!tenantObjectId || !userObjectId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    // Validação explícita — nada de spread de body cru
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

    // Reaproveita a temporária do usuário, se existir
    const tempQuery = await SavedQuery.findOne({
      tenantId: { $eq: tenantObjectId },
      userId: { $eq: userObjectId },
      visibility: { $eq: "temporary" },
    });

    if (tempQuery) {
      tempQuery.queryString = queryString;
      tempQuery.context = context;
      const updated = await tempQuery.save();
      return NextResponse.json(updated, { status: 201 });
    }

    const created = await SavedQuery.create({
      name,
      queryString,
      context,
      visibility,
      tenantId: tenantObjectId,
      userId: userObjectId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Erro ao salvar query:", error);
    return NextResponse.json(
      { error: "Erro ao salvar query" },
      { status: 500 },
    );
  }
}

// ============================================================
// PUT
// ============================================================
export async function PUT(req: NextRequest) {
  try {
    const sessionIds = await getServerSessionIds();
    const tenantObjectId = toObjectId(sessionIds.tenantId);
    if (!tenantObjectId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const id = toObjectId(body.id);
    if (!id) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 },
      );
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

    const updatedQuery = await SavedQuery.findOneAndUpdate(
      {
        _id: { $eq: id },
        tenantId: { $eq: tenantObjectId },
      },
      { $set: updateData },
      { new: true },
    );

    if (!updatedQuery) {
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
export async function DELETE(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantObjectId = toObjectId(sessionIds.tenantId);
  if (!tenantObjectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");
  const idsParam = searchParams.get("ids");

  const ids = toObjectIds(singleId ?? idsParam);

  if (ids.length === 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const result = await SavedQuery.deleteMany({
    _id: { $in: ids },
    tenantId: { $eq: tenantObjectId },
  });

  return NextResponse.json({
    success: true,
    deleted: result.deletedCount,
  });
}