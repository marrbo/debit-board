// app/api/dashboard/stats/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { Project } from '@/models/Project';
import { Team } from '@/models/Team';
import { SavedQuery } from '@/models/SavedQuery';
import { getServerSessionIds } from '@/lib/session-server';
import { parseDBQL } from '@/lib/parseDBQL';
import { subDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const range = searchParams.get('range') || '30d';
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';

  // 1. Resolve DBQL
  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch {}
  }

  // 2. Determina os projetos permitidos (para filtrar as observations)
  let allowedProjectNames: string[] | null = null;
  let allowedProjectIds: any[] | null = null;

  if (teamId && teamId !== 'all') {
    const team = await Team.findById(teamId).lean();
    if (team) {
      allowedProjectIds = team.projectIds || [];
      const teamProjects = await Project.find({ _id: { $in: allowedProjectIds } }).select('name').lean();
      allowedProjectNames = teamProjects.map(p => p.name);
    }
  }

  // 3. Filtro de Observations por DBQL
  const obsMatch: any = { tenantId };
  
  if (finalSearchQuery) {
    const parsedMatch = parseDBQL(finalSearchQuery);
    if (parsedMatch && Object.keys(parsedMatch).length > 0) {
      Object.assign(obsMatch, parsedMatch);
    }
  }

  if (range === '7d') obsMatch.firstSeen = { $gte: subDays(new Date(), 7) };
  else if (range === '14d') obsMatch.firstSeen = { $gte: subDays(new Date(), 14) };
  else if (range === '30d') obsMatch.firstSeen = { $gte: subDays(new Date(), 30) };

  // Se tem time, filtra pelos nomes dos projetos
  if (allowedProjectNames) {
    obsMatch.project = { $in: allowedProjectNames };
  }

  // 4. Stats do Time (Cards)
  const teamPipeline: any[] = [
    { $match: obsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        statuses: { $push: "$status" },
        severities: { $push: "$severity" },
        categories: { $push: "$category" },
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        statusTotals: { $arrayToObject: { $map: { input: { $setUnion: "$statuses" }, as: "st", in: { k: "$$st", v: { $size: { $filter: { input: "$statuses", as: "sta", cond: { $eq: ["$$sta", "$$st"] } } } } } } } },
        severityTotals: { $arrayToObject: { $map: { input: { $setUnion: "$severities" }, as: "sev", in: { k: "$$sev", v: { $size: { $filter: { input: "$severities", as: "s", cond: { $eq: ["$$s", "$$sev"] } } } } } } } },
        categoryTotals: { $arrayToObject: { $map: { input: { $setUnion: "$categories" }, as: "cat", in: { k: "$$cat", v: { $size: { $filter: { input: "$categories", as: "c", cond: { $eq: ["$$c", "$$cat"] } } } } } } } }
      }
    }
  ];

  const teamStatsResult = await Observation.aggregate(teamPipeline);
  const teamStats = teamStatsResult[0] || { total: 0, statusTotals: {}, severityTotals: {}, categoryTotals: {} };

  // 5. Stats por Projeto (Grid)
  const projectPipeline: any[] = [
    { $match: obsMatch },
    {
      $group: {
        _id: "$project",
        statuses: { $push: "$status" },
        severities: { $push: "$severity" },
        categories: { $push: "$category" },
      }
    },
    {
      $project: {
        _id: 0,
        project: "$_id",
        total: { $size: "$statuses" },
        statusTotals: { $arrayToObject: { $map: { input: { $setUnion: "$statuses" }, as: "st", in: { k: "$$st", v: { $size: { $filter: { input: "$statuses", as: "sta", cond: { $eq: ["$$sta", "$$st"] } } } } } } } },
        severityTotals: { $arrayToObject: { $map: { input: { $setUnion: "$severities" }, as: "sev", in: { k: "$$sev", v: { $size: { $filter: { input: "$severities", as: "s", cond: { $eq: ["$$s", "$$sev"] } } } } } } } },
        categoryTotals: { $arrayToObject: { $map: { input: { $setUnion: "$categories" }, as: "cat", in: { k: "$$cat", v: { $size: { $filter: { input: "$categories", as: "c", cond: { $eq: ["$$c", "$$cat"] } } } } } } } }
      }
    }
  ];

  const projectStatsData = await Observation.aggregate(projectPipeline);
  
  const projectStats: Record<string, any> = {};
  projectStatsData.forEach((item: any) => {
    projectStats[item.project] = {
      total: item.total,
      severity: item.severityTotals,
      status: item.statusTotals,
      category: item.categoryTotals,
    };
  });

  return NextResponse.json({ teamStats, projectStats });
}