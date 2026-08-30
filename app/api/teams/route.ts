// app/api/teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Team } from '@/models/Team';
import { useClientSessionIds } from '@/lib/utils';

export async function GET() {
  const {tenantId} = useClientSessionIds();

  try { 
    await connectToDatabase();
    const teams = await Team.find({ tenantId }).lean();
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({error: 'Erro ao buscar Teams'}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { 
    const {tenantId} = useClientSessionIds();

    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    await connectToDatabase();
    const newTeam = new Team({
      tenantId,
      name: body.name,
      members: body.members || [],
    });
    await newTeam.save();
    return NextResponse.json(newTeam);
  } catch (error) {
    return NextResponse.json({error: 'Erro ao gravar Teams'}, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try { 
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('id');
    if (!teamId) return NextResponse.json({ error: 'Team ID required' }, { status: 400 });

    await connectToDatabase();
    await Team.findByIdAndDelete(teamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({error: 'Erro ao excluir Teams'}, { status: 500 });
  }
}