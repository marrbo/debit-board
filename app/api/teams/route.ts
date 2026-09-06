import { type NextRequest, NextResponse } from 'next/server';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';
import { handleGenericGet } from '@/lib/api-handler';
import type { PipelineStage } from 'mongoose';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeGlobal = searchParams.get('includeGlobal') !== 'false'; // default true
  const isAll = searchParams.get('all') === 'true'; // 🔥 suporta exportação completa

  // Filtro adicional: ocultar o time global quando solicitado
  const additionalMatch: Record<string, unknown> = {};
  if (!includeGlobal) {
    additionalMatch.isGlobal = { $ne: true };
  }

  // Pipeline customizado para adicionar projectCount
  const customPipeline: PipelineStage[] = [
    {
      $addFields: {
        projectCount: { $size: { $ifNull: ["$projectIds", []] } }
      }
    }
  ];

  // Delega toda a lógica de paginação, ordenação e busca ao handler genérico
  return handleGenericGet(req, {
    model: Team,
    defaultSort: 'createdAt',
    additionalMatch,
    customPipeline,
    all: isAll,
    projection: {
      _id: 1,
      name: 1,
      description: 1,
      projectIds: 1,
      tenantId: 1,
      isGlobal: 1,
      createdAt: 1,
      updatedAt: 1,
      projectCount: 1
    }
  });
}

export async function POST(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;
  // O handleGenericGet não é usado aqui porque estamos criando um registro
  const body = await req.json();
  const { name, description, projectIds, isGlobal } = body;

  if (!name) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  const newTeam = await Team.create({
    name,
    description: description || '',
    projectIds: projectIds || [],
    tenantId,
    isGlobal: isGlobal || false,
  });

  await Project.updateMany(
    { _id: { $in: projectIds || [] }, tenantId: { $eq: tenantId } },
    { $set: { teamId: newTeam._id } }
  );

  return NextResponse.json(newTeam, { status: 201 });
}