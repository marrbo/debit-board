import { type NextRequest, NextResponse } from 'next/server';
import { handleGenericGet } from '@/lib/api-handler';
import { Observation } from '@/models/Observation';
import { SavedQuery } from '@/models/SavedQuery';
import { VulnerabilityPattern, type IVulnerabilityPattern } from '@/models/VulnerabilityPattern';
import type { IObservation } from '@/types/IObservation';

// Função auxiliar para resolver pattern.name na query
async function resolvePatternNameQuery(query: string): Promise<{ cleanedQuery: string, patternIds: any[] } | null> {
  if (!query || !query.includes('pattern.name')) return { cleanedQuery: query, patternIds: [] };

  // Regex para capturar pattern.name:"valor" ou pattern.name:valor
  const patternRegex = /pattern\.name:(?:"([^"]*)"|(\S+))/gi;
  let match: RegExpExecArray | null;
  const patternNames: string[] = [];

  while ((match = patternRegex.exec(query)) !== null) {
    const value = match[1] || match[2];
    if (value) patternNames.push(value);
  }

  // Se não encontrou nomes, retorna vazio
  if (patternNames.length === 0) return { cleanedQuery: query, patternIds: [] };

  // Busca os patterns pelos nomes
  const patterns = await VulnerabilityPattern.find({ name: { $in: patternNames } })
    .select('_id')
    .lean();

  const patternIds = patterns.map(p => p._id);

  // Se nenhum pattern foi encontrado, retorna vazio para não trazer resultados
  if (patternIds.length === 0) {
    return { cleanedQuery: '', patternIds: [] };
  }

  // Remove as ocorrências de pattern.name:... da query
  let cleanedQuery = query.replace(patternRegex, '');

  // Limpa espaços extras e operadores soltos
  cleanedQuery = cleanedQuery.replace(/\s+/g, ' ').trim();
  cleanedQuery = cleanedQuery.replace(/^(AND|OR)\s+/i, '').replace(/\s+(AND|OR)$/i, '');

  return { cleanedQuery, patternIds };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get('q');
  const isAll = searchParams.get('all') === 'true';

  let finalSearchQuery = '';

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

  const tenantId = searchParams.get('tenantId');
  if (tenantId) additionalMatch.tenantId = tenantId;

  // 🔥 Resolver pattern.name antes de processar a query
  const patternResolution = await resolvePatternNameQuery(finalSearchQuery);
  if (patternResolution) {
    finalSearchQuery = patternResolution.cleanedQuery;
    if (patternResolution.patternIds.length > 0) {
      additionalMatch.patternId = { $in: patternResolution.patternIds };
    }
  }

  try {
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

    const responseData = await result.json();

    const observations = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []);

    // Enriquecimento com dados do pattern
    if (observations.length > 0) {
      const patternIds = observations
        .map((o: IObservation) => o.patternId)
        .filter((id: IObservation) => id !== undefined && id !== null);

      if (patternIds.length > 0) {
        const patterns = await VulnerabilityPattern.find({ _id: { $in: patternIds } })
          .select('_id name description recommendation score severity category externalId externalLink')
          .lean();

        const patternMap = new Map(
          patterns.map((p: IVulnerabilityPattern) => [p._id.toString(), p])
        );

        observations.forEach((obs: IObservation) => {
          const pattern = patternMap.get(obs.patternId?.toString());
          if (pattern) {
            obs.patternName = pattern.name;
            obs.description = pattern.description;
            obs.recommendation = pattern.recommendation;
            obs.pattern = pattern;
          } else {
            obs.patternName = '';
            obs.description = '';
            obs.recommendation = '';
            obs.pattern = null;
          }
        });
      } else {
        observations.forEach((obs: IObservation) => {
          obs.patternName = '';
          obs.description = '';
          obs.recommendation = '';
        });
      }
    }

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