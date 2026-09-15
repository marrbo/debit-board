// app/api/patterns/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { SavedQuery } from '@/models/SavedQuery';
import { handleGenericGet } from '@/lib/api-handler';
import { getServerAuthSession } from '@/lib/auth-server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  // 1. Autenticação
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';
  const isAll = searchParams.get('all') === 'true';
  const categoriesOnly = searchParams.get('categories') === 'true';

  // 2. Modo "categorias" (compatibilidade legada)
  if (categoriesOnly) {
    const patterns = await VulnerabilityPattern
      .find({ enabled: true })
      .select('category')
      .lean();

    const categories = Array.from(
      new Set(patterns.map((p: any) => p.category).filter(Boolean))
    );

    return NextResponse.json(categories);
  }

  // 3. Resolve DBQL (se houver saved query)
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

  // 4. Lista paginada — pattern é GLOBAL, então skipTenantFilter: true
  return handleGenericGet(req, {
    model: VulnerabilityPattern,
    defaultSort: 'name',
    overrideSearchQuery: finalSearchQuery,
    all: isAll,
    skipTenantFilter: true, // para collections que não possuem tenantId (globais)
    projection: {
      _id: 1,
      name: 1,
      queryPattern: 1,
      severity: 1,
      category: 1,
      description: 1,
      recommendation: 1,
      slaHours: 1,
      externalId: 1,
      externalLink: 1,
      reference: 1,
      enabled: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  });
}