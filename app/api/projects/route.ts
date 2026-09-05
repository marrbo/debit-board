// app/api/projects/route.ts
import { type NextRequest } from 'next/server';
import { Project } from '@/models/Project';
import { SavedQuery } from '@/models/SavedQuery';
import { handleGenericGet } from '@/lib/api-handler';
import type { PipelineStage } from 'mongoose';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';

  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch (error) {
      console.error('Erro ao buscar SavedQuery:', error);
    }
  }

  const projectCustomPipeline: PipelineStage[] = [
    {
      $lookup: {
        from: 'repositories',
        let: { pid: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: [ "$projectId", "$$pid" ] } } },
          { $count: 'count' }
        ],
        as: 'repoCount'
      }
    },
    {
      $addFields: {
        repositoryCount: { $ifNull: [ { $arrayElemAt: [ "$repoCount.count", 0 ] }, 0 ] }
      }
    }
  ];

  // Rota limpa, usada APENAS para a tela de Configurações
  return handleGenericGet(req, {
    model: Project,
    defaultSort: 'createdAt',
    overrideSearchQuery: finalSearchQuery,
    projection: {
      _id: 1, name: 1, azureProjectId: 1, url: 1, description: 1,
      defaultTeamImageUrl: 1, repositoryCount: 1, syncDate: 1,
      createdAt: 1, tenantId: 1, teamId: 1
    },
    customPipeline: projectCustomPipeline
  });
}