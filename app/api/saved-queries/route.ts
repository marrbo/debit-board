// app/api/saved-queries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SavedQuery } from '@/models/SavedQuery';
import { getServerAuthSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id; // sub do OpenID
  const tenantId = session.user.tenantId;

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || '';

    // Monta a condição com $or
    const filter: any = {
      $or: [
        // 1. Queries do próprio usuário no seu tenant (todas as visibilidades)
        { tenantId: tenantId, sub: userId },
        // 2. Queries públicas (qualquer tenant/user)
        { visibility: 'public' },
        // 3. Queries compartilhadas no mesmo tenant
        { tenantId: tenantId, visibility: 'shared' },
        // 4. Queries temporárias no mesmo tenant
        // { tenantId: tenantId, visibility: 'temporary' }
      ]
    };

    // Se houver filtro por contexto, adiciona à raiz (aplica a todos os documentos)
    if (context) filter.context = context;

    const queries = await SavedQuery.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(queries, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-validate, max-age=0',
      },
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar SavedQueries:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    
    const body = await req.json();
    const { name, tenantId, sub: userId, queryString, context, visibility } = body;

    if (!name || !queryString) {
      return NextResponse.json({ error: 'Nome e query são obrigatórios.' }, { status: 400 });
    }

    

    const newSavedQuery = await SavedQuery.create({
      tenantId: tenantId || session.user.tenantId,
      sub: userId || session.user.id,
      name,
      queryString,
      context: context || 'observations',
      visibility
    });

    return NextResponse.json(newSavedQuery, { status: 201 });
  } catch (error: any) {
    console.error('❌ Erro ao criar SavedQuery:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const body = await req.json();

    body.tenantId ??= session.user.tenantId;

    const { id, name, sub, tenantId, queryString, context, visibility } = body;

    if (!id || !name || !queryString) {
      return NextResponse.json({ error: 'ID, nome e query são obrigatórios.' }, { status: 400 });
    }

    const updated = await SavedQuery.findOneAndUpdate(
      { _id: id, tenantId, sub: session.user.id },
      { name, queryString, context: context || 'observations', visibility },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('❌ Erro ao atualizar SavedQuery:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });
    }

    const deleted = await SavedQuery.findOneAndDelete({ _id: id, sub: session.user.id, tenantId: session.user.tenantId });
    if (!deleted) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao deletar SavedQuery:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}