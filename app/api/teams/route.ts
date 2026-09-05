import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { getServerSessionIds } from '@/lib/session-server';

export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  await connectToDatabase();

  const teams = await Team.find({ tenantId: tenantId })
    .select('_id name description projectIds tenantId isGlobal createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  // Adiciona contagem para o grid
  const data = teams.map(team => ({
    ...team,
    projectCount: team.projectIds?.length || 0,
    projectIds: team.projectIds || []
  }));

  return NextResponse.json({ data, total: data.length });
}

export async function POST(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  await connectToDatabase();

  const body = await req.json();
  const { name, description, projectIds, isGlobal } = body;

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

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