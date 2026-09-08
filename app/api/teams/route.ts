import { type NextRequest, NextResponse } from 'next/server';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';
import { handleGenericGet } from '@/lib/api-handler';
import type { PipelineStage } from 'mongoose';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeGlobal = searchParams.get('includeGlobal') !== 'false';
  const isAll = searchParams.get('all') === 'true';

  const additionalMatch: Record<string, unknown> = {};
  if (!includeGlobal) {
    additionalMatch.isGlobal = { $ne: true };
  }

  const customPipeline: PipelineStage[] = [
    { $addFields: { projectCount: { $size: { $ifNull: ["$projectIds", []] } } } }
  ];

  return handleGenericGet(req, {
    model: Team,
    defaultSort: 'createdAt',
    additionalMatch,
    customPipeline,
    all: isAll,
    projection: {
      _id: 1, name: 1, description: 1, projectIds: 1, tenantId: 1, isGlobal: 1, createdAt: 1, updatedAt: 1, projectCount: 1
    }
  });
}

export async function POST(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;
  const body = await req.json();
  const { name, description, projectIds = [], isGlobal } = body;

  // 🔥 Normaliza para array plano (achata se vier aninhado)
  const flatProjectIds = Array.isArray(projectIds) ? projectIds.flat() : [];

  // Converte para ObjectId e valida existência
  const validProjectIds = flatProjectIds
    .map((id) => (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null))
    .filter((id) => id !== null);

  const newTeam = await Team.create({
    name,
    description: description || '',
    projectIds: validProjectIds,
    tenantId,
    isGlobal: isGlobal || false,
  });

  // Atualiza apenas os projetos que realmente existem
  if (validProjectIds.length > 0) {
    await Project.updateMany(
      { _id: { $in: validProjectIds }, tenantId },
      { $set: { teamId: newTeam._id } }
    );
  }

  return NextResponse.json(newTeam, { status: 201 });
}