import { type NextRequest, NextResponse } from 'next/server';
import { handleGenericGet } from '@/lib/api-handler';
import { Observation } from '@/models/Observation';
import { SavedQuery } from '@/models/SavedQuery';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';
  const isAll = searchParams.get('all') === 'true';

  let finalSearchQuery = searchQueryRaw;

  // Se houver um ID de saved query, busca a query e usa como filtro
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) {
        finalSearchQuery = savedQuery.queryString;
      }
    } catch (error) {
      console.error('Erro ao buscar SavedQuery:', error);
      return NextResponse.json({ error: 'Erro ao carregar saved query' }, { status: 500 });
    }
  }

  const additionalMatch: Record<string, unknown> = {};
  const projectId = searchParams.get('projectId');
  if (projectId && projectId !== 'all') additionalMatch.projectId = projectId;

  // Filtro por tenantId (se existir)
  const tenantId = searchParams.get('tenantId');
  if (tenantId) additionalMatch.tenantId = tenantId;

  try {
    return await handleGenericGet(req, {
      model: Observation,
      defaultSort: 'firstSeen',
      additionalMatch,
      overrideSearchQuery: finalSearchQuery,
      projection: {
        _id: 1, fileName: 1, filePath: 1, category: 1,
        branch: 1, severity: 1, status: 1, slaDueAt: 1,
        assignedTo: 1, hitCount: 1, project: 1, repository: 1,
      },
      all: isAll, // ✅ Passa all para o handler
    });
  } catch (error) {
    console.error('Erro ao buscar observations:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar observations' }, { status: 500 });
  }
}