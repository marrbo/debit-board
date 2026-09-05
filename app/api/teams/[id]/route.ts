import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';
import { Types } from 'mongoose';

// Ajuste na tipagem dos params para Promise
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;

  await connectToDatabase();

  // Aguarda a resolução dos params
  const { id } = await params;

  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: 'ID de team inválido' }, { status: 400 });
  }

  const body = await req.json();
  const { name, description, projectIds } = body;

  if (
    projectIds !== undefined &&
    (!Array.isArray(projectIds) ||
      projectIds.some((projectId) => typeof projectId !== 'string' || !/^[a-f\d]{24}$/i.test(projectId)))
  ) {
    return NextResponse.json({ error: 'IDs de projeto inválidos' }, { status: 400 });
  }

  const team = await Team.findOne({ _id: { $eq: id }, tenantId: { $eq: tenantId } });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  // Remove teamId dos projetos antigos
  await Project.updateMany(
    { teamId: team._id, tenantId: { $eq: tenantId } },
    { $unset: { teamId: 1 } }
  );

  // Atualiza o Team
  team.name = name || team.name;
  team.description = description || team.description;
  team.projectIds = projectIds || [];
  await team.save();

  // Atribui teamId aos novos projetos
  await Project.updateMany(
    {
      _id: {
        $in: (projectIds || []).map((projectId: string) => new Types.ObjectId(projectId)),
      },
      tenantId: { $eq: tenantId },
    },
    { $set: { teamId: team._id } }
  );

  return NextResponse.json(team);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;

  await connectToDatabase();

  // Aguarda a resolução dos params
  const { id } = await params;

  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: 'ID de team inválido' }, { status: 400 });
  }

  const team = await Team.findOne({ _id: { $eq: id }, tenantId: { $eq: tenantId } });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  await Project.updateMany(
    { teamId: team._id, tenantId: { $eq: tenantId } },
    { $unset: { teamId: 1 } }
  );

  await team.deleteOne();

  return NextResponse.json({ message: 'Team deletado' });
}