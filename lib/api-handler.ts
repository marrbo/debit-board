// lib/api-handler.ts
import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSessionIds } from '@/lib/session-server';
import { parseDBQL } from '@/lib/parseDBQL';
import type { Model, PipelineStage } from 'mongoose';

interface ProjectionObject {
  [key: string]: ProjectionValue;
}
type ProjectionValue = string | number | boolean | ProjectionObject;

interface FacetResult<T> {
  data: T[];
  total: { count: number }[];
}

interface GenericGetOptions<T> {
  model: Model<T | any>;
  defaultSort?: string;
  projection?: Record<string, ProjectionValue>;
  customPipeline?: PipelineStage[];
  additionalMatch?: Record<string, unknown>;
  overrideSearchQuery?: string;
  all?: boolean; // ✅ suporta exportação de todos os dados
}

export async function handleGenericGet<T>(
  req: NextRequest,
  options: GenericGetOptions<T>
) {
  const {
    model,
    defaultSort = 'createdAt',
    projection = {},
    customPipeline = [],
    additionalMatch = {},
    overrideSearchQuery,
    all = false,
  } = options;

  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);

  // Prioridade: override (banco) -> URL param -> vazio
  const searchQuery = overrideSearchQuery || searchParams.get('search') || '';

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sortField = searchParams.get('sort') || defaultSort;
  const sortOrder = searchParams.get('order') === 'asc' ? 1 : -1;

  // Monta o match base
  const baseMatch: Record<string, unknown> = { ...additionalMatch };
  if (tenantId) {
    baseMatch.tenantId = tenantId;
  }

  let finalMatch: Record<string, unknown>;

  if (searchQuery) {
    try {
      const parsedMatch = parseDBQL(searchQuery);
      if (parsedMatch && Object.keys(parsedMatch).length > 0) {
        const combinedMatch: Record<string, unknown> = { ...baseMatch };
        combinedMatch['$and'] = [baseMatch, parsedMatch];
        finalMatch = combinedMatch;
      } else {
        finalMatch = baseMatch;
      }
    } catch (err) {
      console.error('Erro ao parsear DBQL:', err);
      return NextResponse.json({ error: 'Invalid DBQL query' }, { status: 400 });
    }
  } else {
    finalMatch = baseMatch;
  }

  // Se all=true, ignora paginação e retorna todos os documentos
  if (all) {
    const pipeline: PipelineStage[] = [
      { $match: finalMatch },
      ...customPipeline,
      { $sort: { [sortField]: sortOrder } },
      { $project: projection },
    ];

    const allData = await model.aggregate<T[]>(pipeline);
    return NextResponse.json({
      data: allData,
      total: allData.length,
      page: 1,
      limit: allData.length,
      totalPages: 1,
    });
  }

  // Pipeline com paginação (facet)
  const pipeline: PipelineStage[] = [
    { $match: finalMatch },
    ...customPipeline,
    { $sort: { [sortField]: sortOrder } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: projection },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const results = await model.aggregate<FacetResult<T>>(pipeline);

  if (!results || results.length === 0) {
    return NextResponse.json({ data: [], total: 0, page, limit, totalPages: 0 });
  }

  const result = results[0];
  const data = result.data ?? [];
  const totalArray = result.total;
  const totalCount = (totalArray && totalArray.length > 0) ? totalArray[0].count : 0;

  return NextResponse.json({
    data,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  });
}