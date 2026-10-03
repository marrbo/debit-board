// app/api/patterns/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { SavedQuery } from "@/models/SavedQuery";
import { handleGenericGet } from "@/lib/api-handler";
import { connectToDatabase } from "@/lib/mongodb";
import { requireRole } from "@/lib/api-auth";

/**
 * Lista patterns de segurança.
 *
 * Paginado via `handleGenericGet`. Inclui patterns obsoletos (o
 * cliente decide se filtra via `deprecated:false` na DBQL).
 *
 * @summary Lista patterns
 * @tags Patterns
 * @route GET /api/patterns
 * @access admin
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get("q");
  const searchQueryRaw = searchParams.get("search") || "";
  const isAll = searchParams.get("all") === "true";
  const categoriesOnly = searchParams.get("categories") === "true";

  if (categoriesOnly) {
    const patterns = await VulnerabilityPattern.find({ enabled: true })
      .select("category")
      .lean();
    const categories = Array.from(
      new Set(patterns.map((p: any) => p.category).filter(Boolean)),
    );
    return NextResponse.json(categories);
  }

  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) {
        finalSearchQuery = savedQuery.queryString;
      }
    } catch (error) {
      console.error("Erro ao buscar SavedQuery:", error);
    }
  }

  return handleGenericGet(req, {
    model: VulnerabilityPattern,
    defaultSort: "name",
    overrideSearchQuery: finalSearchQuery,
    all: isAll,
    skipTenantFilter: true,
    projection: {
      _id: 1,
      dbId: 1,
      dbName: 1,
      name: 1,
      queryPattern: 1,
      severity: 1,
      category: 1,
      description: 1,
      recommendation: 1,
      score: 1,
      slaHours: 1,
      externalId: 1,
      externalLink: 1,
      externalIdCWE: 1,
      externalLinkCWE: 1,
      reference: 1,
      enabled: 1,
      deprecated: 1,
      deprecatedAt: 1,
      deprecatedReason: 1,
      supersededBy: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  });
}

/**
 * Cria um novo pattern.
 *
 * @summary Cria pattern
 * @tags Patterns
 * @route POST /api/patterns
 * @access admin
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  await connectToDatabase();
  const body = await req.json();

  try {
    const created = await VulnerabilityPattern.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        {
          error:
            "Já existe um pattern com esse dbId ou dbName. Escolha outro identificador.",
        },
        { status: 409 },
      );
    }
    if (isValidationError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

/**
 * Atualiza um pattern.
 *
 * Bloqueia mudança de `dbId` e `dbName` (identificadores imutáveis).
 * Bloqueia reativação de patterns obsoletos.
 *
 * @summary Atualiza pattern
 * @tags Patterns
 * @route PUT /api/patterns?id=<mongoId>
 * @access admin
 */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await connectToDatabase();
  const body = await req.json();

  // Identificadores são imutáveis
  delete body.dbId;
  delete body.dbName;
  delete body._id;

  try {
    const updated = await VulnerabilityPattern.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Pattern não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (isValidationError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

/**
 * Remove um pattern.
 *
 * **Bloqueia exclusão** se o pattern foi referenciado por scans ou
 * profiles. Use `PUT` com `deprecated: true` para obsoletá-lo.
 *
 * @summary Remove pattern
 * @tags Patterns
 * @route DELETE /api/patterns?id=<mongoId>
 * @access admin
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await connectToDatabase();

  // Verifica referências em Observation
  const { Observation } = await import("@/models/Observation");
  const usedByObs = await Observation.exists({ patternId: id });
  if (usedByObs) {
    return NextResponse.json(
      {
        error:
          "Este pattern já foi executado em scans. Marque como obsoleto (deprecated) em vez de excluir.",
      },
      { status: 409 },
    );
  }

  await VulnerabilityPattern.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}

// ============================================================
// Helpers
// ============================================================
function isDuplicateKeyError(err: unknown): err is { code: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function isValidationError(err: unknown): err is Error {
  return err instanceof Error && err.name === "ValidationError";
}
