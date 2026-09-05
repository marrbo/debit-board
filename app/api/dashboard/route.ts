// app/api/dashboard/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Project } from '@/models/Project';
import { Observation } from '@/models/Observation';
import { Team } from '@/models/Team';
import { SavedQuery } from '@/models/SavedQuery';
import { getServerSessionIds } from '@/lib/session-server';
import { parseDBQL } from '@/lib/parseDBQL';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortOrder = searchParams.get('order') === 'asc' ? 1 : -1;
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';

  // 1. Resolve a query do DBQL
  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch (error) {
      console.error('Erro ao buscar SavedQuery:', error);
    }
  }

  // 2. Lógica para achar os IDs de Projetos permitidos
  let allowedProjectIds: mongoose.Types.ObjectId[] | null = null;

  // Se há um Time específico, começa com os projetos dele
  if (teamId && teamId !== 'all') {
    const team = await Team.findById(teamId).lean();
    if (!team) return NextResponse.json({ data: [], total: 0 });
    
    const teamProjectIds = (team.projectIds || []).map((id: any) => new mongoose.Types.ObjectId(id));
    allowedProjectIds = teamProjectIds;
  }

  // Se há DBQL, busca os nomes de projetos que batem com a query
  if (finalSearchQuery) {
    const parsedMatch = parseDBQL(finalSearchQuery);
    
    if (parsedMatch && Object.keys(parsedMatch).length > 0) {
      const obsMatch: any = { tenantId };
      
      // Intersecta com os projetos do time, se existir
      if (allowedProjectIds) {
        const teamProjects = await Project.find({ _id: { $in: allowedProjectIds } }).select('name').lean();
        obsMatch.project = { $in: teamProjects.map(p => p.name) };
      }

      Object.assign(obsMatch, parsedMatch);
      const matchedProjectNames = await Observation.distinct('project', obsMatch);

      const matchedProjects = await Project.find({ name: { $in: matchedProjectNames } }).select('_id').lean();
      
      // Atualiza os IDs permitidos (intersecção)
      if (allowedProjectIds) {
        const matchedIds = matchedProjects.map(p => p._id);
        allowedProjectIds = allowedProjectIds.filter(id => matchedIds.some(mid => mid.equals(id)));
      } else {
        allowedProjectIds = matchedProjects.map(p => p._id);
      }
    }
  }

  // 3. Busca os Projetos com paginação
  const filter: any = { tenantId };
  if (allowedProjectIds) {
    filter._id = { $in: allowedProjectIds };
  }

  const skip = (page - 1) * limit;
  
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter)
  ]);

  return NextResponse.json({ data: projects, total });
}