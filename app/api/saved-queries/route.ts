// app/api/saved-queries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SavedQuery } from '@/models/SavedQuery';
import { getServerSessionIds } from '@/lib/session-server';

export async function GET(req: NextRequest) {
  try {
    // ✅ Obtém IDs corretamente (sem inversão)
    const { userId, tenantId } = await getServerSessionIds();

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || '';
    const id = searchParams.get('id');

    if (id) {
      const queryFilter: any = {
        _id: id,
        $or: [
          { tenantId, sub: userId }, // ✅ correto
          { visibility: 'public' },
          { tenantId, visibility: 'shared' }
        ]
      };

      const query = await SavedQuery.findOne(queryFilter).lean();

      if (!query) {
        return NextResponse.json({ error: 'Query não encontrada ou sem permissão' }, { status: 404 });
      }

      return NextResponse.json(query, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-validate, max-age=0',
        },
      });
    }

    const filter: any = {
      $or: [
        { tenantId, sub: userId }, // ✅ correto
        { visibility: 'public' },
        { tenantId, visibility: 'shared' }
      ]
    };

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
  try {
    const { userId, tenantId } = await getServerSessionIds();

    await connectToDatabase();
    const body = await req.json();
    const { name, tenantId: bodyTenant, sub: bodyUser, queryString, context, visibility } = body;

    if (!name || !queryString) {
      return NextResponse.json({ error: 'Nome e query são obrigatórios.' }, { status: 400 });
    }

    const newSavedQuery = await SavedQuery.create({
      tenantId: bodyTenant || tenantId,
      sub: bodyUser || userId,
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
  try {
    const { userId, tenantId: tenantIdFromSession } = await getServerSessionIds();

    await connectToDatabase();
    const body = await req.json();
    const { id, name, sub, queryString, context, visibility } = body;

    if (!id || !name || !queryString) {
      return NextResponse.json({ error: 'ID, nome e query são obrigatórios.' }, { status: 400 });
    }

    const updated = await (SavedQuery as any).findOneAndUpdate(
      { _id: id, tenantId: tenantIdFromSession, sub: sub || userId }, // ✅ correto
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
  try {
    const { userId, tenantId } = await getServerSessionIds();

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });
    }

    const deleted = await (SavedQuery as any).findOneAndDelete({
      _id: id,
      sub: userId,
      tenantId
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao deletar SavedQuery:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}