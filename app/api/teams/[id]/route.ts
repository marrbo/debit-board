import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';

// Ajuste na tipagem dos params para Promise
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;

  await connectToDatabase();

  // Aguarda a resolução dos params
  const { id } = await params;

  const body = await req.json();
  const { name, description, projectIds } = body;

  const team = await Team.findOne({ _id: id, tenantId });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  // Remove teamId dos projetos antigos
  await Project.updateMany(
    { teamId: team._id, tenantId },
    { $unset: { teamId: 1 } }
  );

  // Atualiza o Team
  team.name = name || team.name;
  team.description = description || team.description;
  team.projectIds = projectIds || [];
  await team.save();

  // Atribui teamId aos novos projetos
  await Project.updateMany(
    { _id: { $in: projectIds || [] }, tenantId },
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

  const team = await Team.findOne({ _id: id, tenantId });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  await Project.updateMany(
    { teamId: team._id, tenantId },
    { $unset: { teamId: 1 } }
  );

  await team.deleteOne();

  return NextResponse.json({ message: 'Team deletado' });
}