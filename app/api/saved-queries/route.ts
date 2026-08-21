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

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const context = searchParams.get('context') || '';

    const query: any = { tenantId: session.user.tenantId };
    if (context) query.context = context;

    const queries = await SavedQuery.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(queries);
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
    
    const { name, tenantId, queryString, context, visibility } = body;

    if (!name || !queryString) {
      return NextResponse.json({ error: 'Nome e query são obrigatórios.' }, { status: 400 });
    }

    

    const newSavedQuery = await SavedQuery.create({
      tenantId,
      name,
      queryString,
      context: context || 'issues',
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
    const { id, name, tenantId, queryString, context, visibility } = body;

    if (!id || !name || !queryString) {
      return NextResponse.json({ error: 'ID, nome e query são obrigatórios.' }, { status: 400 });
    }

    const updated = await SavedQuery.findOneAndUpdate(
      { _id: id, tenantId },
      { name, queryString, context: context || 'issues', visibility },
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

    const deleted = await SavedQuery.findOneAndDelete({ _id: id, tenantId: session.user.tenantId });
    if (!deleted) {
      return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao deletar SavedQuery:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}