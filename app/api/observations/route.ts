import { type NextRequest, NextResponse } from 'next/server';
import { handleGenericGet } from '@/lib/api-handler';
import { Observation } from '@/models/Observation';
import { SavedQuery } from '@/models/SavedQuery';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';

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
    // Chama o handler genérico e obtém a resposta
    const result = await handleGenericGet(req, {
      model: Observation,
      defaultSort: 'firstSeen',
      additionalMatch,
      overrideSearchQuery: finalSearchQuery,
      projection: {
        _id: 1, fileName: 1, filePath: 1, category: 1,
        patternId: 1,
        branch: 1, severity: 1, status: 1, slaDueAt: 1,
        assignedTo: 1, hitCount: 1, project: 1, repository: 1,
      },
      all: isAll,
    });

    // Extrai o JSON da resposta
    const responseData = await result.json();

    // Determina a lista de observações (pode ser array ou {data: array})
    const observations = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []);

    if (observations.length > 0) {
      const patternIds = observations
        .map((o: any) => o.patternId)
        .filter((id: any) => id !== undefined && id !== null);

      if (patternIds.length > 0) {
        const patterns = await VulnerabilityPattern.find({ _id: { $in: patternIds } })
          .select('_id name')
          .lean();

        const patternMap = new Map(
          patterns.map((p: any) => [p._id.toString(), p.name])
        );

        observations.forEach((obs: any) => {
          if (obs.patternId) {
            obs.patternName = patternMap.get(obs.patternId.toString()) || '';
          } else {
            obs.patternName = '';
          }
        });
      }
    }

    // Retorna o mesmo formato original (array ou objeto com data)
    if (Array.isArray(responseData)) {
      return NextResponse.json(observations);
    } else {
      return NextResponse.json({ ...responseData, data: observations });
    }
  } catch (error) {
    console.error('Erro ao buscar observations:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar observations' }, { status: 500 });
  }
}