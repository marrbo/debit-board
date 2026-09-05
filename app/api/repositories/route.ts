import { type NextRequest } from 'next/server';
import { Repository } from '@/models/Repository';
import { SavedQuery } from '@/models/SavedQuery';
import { handleGenericGet } from '@/lib/api-handler';
import type { PipelineStage } from 'mongoose';
import { Team } from '@/models/Team';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // 1. Identificação da Query (ID Salvo ou String na URL)
  const dbqlId = searchParams.get('q'); // ou 'dbqlId' dependendo da sua convenção
  const searchQueryRaw = searchParams.get('search') || '';

  const additionalMatch: Record<string, unknown> = {};
  const projectId = searchParams.get('projectId');

  const teamId = searchParams.get('teamId');
  if (teamId && teamId !== 'all') {
    const team = await Team.findById(teamId).lean();
    if (team) {
      const projectIds = (team.projectIds || []).map((id: any) => id.toString());
      additionalMatch.projectId = { $in: projectIds };
    }
  }
  
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

  // 2. Filtros de Match Básico (ex: projectId)
  if (projectId && projectId !== 'all') {
    additionalMatch.projectId = projectId;
  }

  // 3. Tratamento Especial para Projeto (Join)
  // Como o handleGenericGet aplica o $match no início, e o campo 'project' no 
  // modelo Repository é apenas o ID, precisamos extrair a busca por "nome" 
  // para aplicá-la DEPOIS do $lookup.
  let projectNameFilter: string | null = null;
  const projectMatch = finalSearchQuery.match(/\bproject:\s*([^\s]+)/);
  if (projectMatch) {
    projectNameFilter = projectMatch[1];
  }

  // 4. Construção do Pipeline Customizado
  const customPipeline: PipelineStage[] = [
    {
      $addFields: {
        projectObjectId: { $toObjectId: "$projectId" }
      }
    },
    {
      $lookup: {
        from: 'projects',
        localField: 'projectObjectId',
        foreignField: '_id',
        as: 'projectInfo'
      }
    },
    { $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true } }
  ];

  // Se houver busca por nome de projeto, injetamos o match após o lookup
  if (projectNameFilter) {
    const escaped = projectNameFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = projectNameFilter.includes('*') 
      ? escaped.replace(/\*/g, '.*') 
      : '^' + escaped + '$';

    customPipeline.push({
      $match: {
        'projectInfo.name': { $regex: regexPattern, $options: 'i' }
      }
    });
  }

  // 5. Execução via Handler Genérico
  return handleGenericGet(req, {
    model: Repository,
    defaultSort: 'createdAt',
    additionalMatch,
    overrideSearchQuery: finalSearchQuery,
    customPipeline,
    projection: {
      _id: 1,
      name: 1,
      createdAt: 1,
      tenantId: 1,
      project: {
        _id: '$projectInfo._id',
        name: '$projectInfo.name'
      }
    }
  });
}
