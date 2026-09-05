import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Project } from '@/models/Project';
import { Team } from '@/models/Team';
import { getServerSessionIds } from '@/lib/session-server';

export async function POST(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  await connectToDatabase();

  const body = await req.json();
  const { projectIds, teamId, newTeamName, description } = body;

  if (!projectIds || projectIds.length === 0) {
    return NextResponse.json({ error: 'Nenhum projeto selecionado.' }, { status: 400 });
  }

  let targetTeamId = teamId;

  // Se foi solicitado criar um novo time
  if (!targetTeamId && newTeamName) {
    const newTeam = await Team.create({
      name: newTeamName,
      description: description || '',
      projectIds: [],
      tenantId,
      isGlobal: false
    });
    targetTeamId = newTeam._id;
  }

  if (!targetTeamId) {
    return NextResponse.json({ error: 'Selecione um time ou crie um novo.' }, { status: 400 });
  }

  // 🔥 Atualiza os projetos para apontar para o novo time
  await Project.updateMany(
    { _id: { $in: projectIds }, tenantId: { $eq: tenantId } },
    { $set: { teamId: targetTeamId } }
  );

  // 🔥 Atualiza a lista de projectIds do time
  await Team.updateOne(
    { _id: { $eq: targetTeamId }, tenantId: { $eq: tenantId } },
    { $addToSet: { projectIds: { $each: projectIds } } }
  );

  return NextResponse.json({ success: true, teamId: targetTeamId });
}