import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';
import { Types } from 'mongoose';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;
  await connectToDatabase();

  const { id } = await params;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: 'ID de team inválido' }, { status: 400 });
  }

  const body = await req.json();
  const { name, description, projectIds } = body;

  // Validação dos projectIds
  if (projectIds !== undefined && !Array.isArray(projectIds)) {
    return NextResponse.json({ error: 'projectIds deve ser um array' }, { status: 400 });
  }

  const team = await Team.findOne({ _id: id, tenantId });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  // 🔥 Converte e valida os novos projectIds
  const flatProjectIds = Array.isArray(projectIds) ? projectIds.flat() : [];

  const validProjectIds = (flatProjectIds || []).map((pId: any) => {
    if (typeof pId === 'string' && Types.ObjectId.isValid(pId)) return new Types.ObjectId(pId);
    return null;
  }).filter((id): id is Types.ObjectId => id !== null);

  // Busca projetos existentes
  const existingProjects = await Project.find({ _id: { $in: validProjectIds }, tenantId }).select('_id').lean();
  const existingIds = existingProjects.map(p => p._id.toString());
  const finalProjectIds = validProjectIds.filter(id => existingIds.includes(id.toString()));

  // Remove teamId dos projetos antigos que NÃO estão na nova lista
  const oldProjectIds = team.projectIds || [];
  const projectsToRemove = oldProjectIds.filter(id => !finalProjectIds.some(newId => newId.equals(id)));
  if (projectsToRemove.length > 0) {
    await Project.updateMany(
      { _id: { $in: projectsToRemove }, tenantId },
      { $unset: { teamId: 1 } }
    );
  }

  // Atualiza team
  team.name = name || team.name;
  team.description = description || team.description;
  team.projectIds = finalProjectIds;
  await team.save();

  // Atribui teamId aos novos projetos
  if (finalProjectIds.length > 0) {
    await Project.updateMany(
      { _id: { $in: finalProjectIds }, tenantId },
      { $set: { teamId: team._id } }
    );
  }

  return NextResponse.json(team);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;
  await connectToDatabase();

  const { id } = await params;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: 'ID de team inválido' }, { status: 400 });
  }

  const team = await Team.findOne({ _id: id, tenantId });
  if (!team) return NextResponse.json({ error: 'Team não encontrado' }, { status: 404 });

  await Project.updateMany(
    { teamId: team._id, tenantId },
    { $unset: { teamId: 1 } }
  );

  await team.deleteOne();

  return NextResponse.json({ message: 'Team deletado' });
}