// app/api/projects/route.ts
import { type NextRequest } from 'next/server';
import { Project } from '@/models/Project';
import { SavedQuery } from '@/models/SavedQuery';
import { handleGenericGet } from '@/lib/api-handler';
import type { PipelineStage } from 'mongoose';

/**
 * Lista recursos do endpoint /api/projects.
 *
 * Este endpoint expõe a operação get em /api/projects.
 *
 * @summary Lista recursos do endpoint /api/projects
 * @tags Projects
 * @route GET /api/projects
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';
  const isAll = searchParams.get('all') === 'true'; // 🔹 Retorna todos, sem paginação
  const available = searchParams.get('available') === 'true'; // 🔹 Somente disponíveis (sem time)

  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch (error) {
      console.error('Erro ao buscar SavedQuery:', error);
    }
  }

  // 🔹 Filtro adicional: apenas projetos disponíveis (sem time)
  const additionalMatch: Record<string, unknown> = {};
  if (available) {
    additionalMatch.teamId = { $in: [null, undefined] };
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

  return handleGenericGet(req, {
    model: Project,
    defaultSort: 'createdAt',
    additionalMatch,
    overrideSearchQuery: finalSearchQuery,
    all: isAll,
    projection: {
      _id: 1, name: 1, azureProjectId: 1, url: 1, description: 1,
      defaultTeamImageUrl: 1, repositoryCount: 1, syncDate: 1,
      createdAt: 1, tenantId: 1, teamId: 1, isActive: 1
    },
    customPipeline: projectCustomPipeline
  });
}