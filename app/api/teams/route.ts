// app/api/teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { getServerAuthSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectToDatabase();
  const teams = await Team.find({ tenantId: session.user.tenantId }).lean();
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  await connectToDatabase();
  const newTeam = new Team({
    tenantId: session.user.tenantId,
    name: body.name,
    members: body.members || [],
  });
  await newTeam.save();
  return NextResponse.json(newTeam);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('id');
  if (!teamId) return NextResponse.json({ error: 'Team ID required' }, { status: 400 });

  await connectToDatabase();
  await Team.findByIdAndDelete(teamId);
  return NextResponse.json({ success: true });
}