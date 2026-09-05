import { handleGenericGet } from "@/lib/api-handler";
import { SavedQuery } from "@/models/SavedQuery";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // ✅ Se o parâmetro 'id' estiver presente, retorna a consulta específica
  const idParam = searchParams.get('id');
  if (idParam) {
    const savedQuery = await SavedQuery.findById(idParam).lean();
    if (!savedQuery) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });
    }
    return NextResponse.json(savedQuery);
  }

  // 1. Identificação da Query (ID Salvo ou String na URL)
  const dbqlId = searchParams.get('q'); // ou 'dbqlId' dependendo da sua convenção
  const searchQueryRaw = searchParams.get('search') || '';

  let finalSearchQuery = searchQueryRaw;

  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) {
        finalSearchQuery = savedQuery.queryString;
      }
    } catch (error) {
      console.error('Erro ao buscar SavedQuery:', error);
    }
  }

  // 2. Filtros Básicos (ex: tenantId, context, visibility)
  const additionalMatch: Record<string, unknown> = {};

  const tenantId = searchParams.get('tenantId');
  if (tenantId) additionalMatch.tenantId = tenantId;

  const context = searchParams.get('context');
  if (context && context !== 'all') additionalMatch.context = context;

  const visibility = searchParams.get('visibility');
  if (visibility && visibility !== 'all') additionalMatch.visibility = visibility;

  // 3. Execução via Handler Genérico
  return handleGenericGet(req, {
    model: SavedQuery,
    defaultSort: 'createdAt',
    additionalMatch,
    overrideSearchQuery: finalSearchQuery,
    projection: {
      _id: 1,
      name: 1,
      queryString: 1,
      context: 1,
      visibility: 1,
      createdAt: 1,
      tenantId: 1,
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = req.headers.get('x-tenant-id');

    if (!body.name || !body.queryString) {
      return NextResponse.json({ error: 'Nome e Query são obrigatórios' }, { status: 400 });
    }

    // buscar query temporaria do usuario
    const tempQuery = await SavedQuery.findOne({ userId: body.userId, visibility: 'temporary' })

    if (tempQuery) {
      tempQuery.queryString = body.queryString;
      tempQuery.context = body.context;
      const updatedQuery = await SavedQuery.findByIdAndUpdate(
        tempQuery._id,
        { $set: tempQuery },
        { new: true }
      );
      return NextResponse.json(updatedQuery, { status: 201 });
    }

    const newQuery = await SavedQuery.create({
      ...body,
      tenantId: tenantId || 'pending'
    });

    return NextResponse.json(newQuery, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar query' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

    const updatedQuery = await SavedQuery.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedQuery) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });

    return NextResponse.json(updatedQuery);
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar query' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Suporta tanto ?id=... (um único ID) quanto ?ids=id1,id2,id3 (vários IDs)
    const singleId = searchParams.get('id');
    const idsParam = searchParams.get('ids');

    let ids: string[] = [];
    
    if (singleId) {
      ids = [singleId];
    } else if (idsParam) {
      ids = idsParam.split(',').filter(Boolean);
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Exclui todos os IDs fornecidos
    await SavedQuery.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Erro ao deletar queries:', error);
    return NextResponse.json({ error: 'Erro ao deletar queries' }, { status: 500 });
  }
}