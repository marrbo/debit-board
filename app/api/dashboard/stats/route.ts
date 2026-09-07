// app/api/dashboard/stats/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { Project } from '@/models/Project';
import { Team } from '@/models/Team';
import { SavedQuery } from '@/models/SavedQuery';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { getServerSessionIds } from '@/lib/session-server';
import { parseDBQL } from '@/lib/parseDBQL';
import { subDays } from 'date-fns';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const range = searchParams.get('range') || '30d';
  const dbqlId = searchParams.get('q');
  const searchQueryRaw = searchParams.get('search') || '';

  let finalSearchQuery = searchQueryRaw;
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch {}
  }

  let allowedProjectNames: string[] | null = null;
  let allowedProjectIds: mongoose.Types.ObjectId[] | null = null;
  
  if (teamId && teamId !== 'all') {
    const teamObjectId = mongoose.Types.ObjectId.isValid(teamId) ? new mongoose.Types.ObjectId(teamId) : null;
    const team = await Team.findById(teamObjectId).lean();
    if (team) {
      // 🔥 Converte todos os projectIds para ObjectId (defensivo)
      allowedProjectIds = (team.projectIds || []).map((id: any) => {
        if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return id;
      });
      
      const teamProjects = await Project.find({ _id: { $in: allowedProjectIds } }).select('name').lean();
      allowedProjectNames = teamProjects.map(p => p.name);
    }
  }
// Filtro base
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

  if (allowedProjectNames) {
    obsMatch.project = { $in: allowedProjectNames };
  }

  // 🔥 Filtro extra para agregações de categoria: ignora patternId nulo/vazio
  const categoryMatch = {
    ...obsMatch,
    patternId: { $exists: true, $nin: [null, ""] },
  };

  // 4. Stats do Time (Cards) - mantém para os cards principais
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

  // 4.1 - Agrupamento por categoria e patternId (somente com patternId válido)
  const categoryPipeline = [
    { $match: categoryMatch },
    { $group: { _id: { category: "$category", patternId: "$patternId" } } },
    { $group: { _id: "$_id.category", count: { $sum: 1 } } },
    { $project: { _id: 0, category: "$_id", count: 1 } }
  ];

  const categoryStatsResult = await Observation.aggregate(categoryPipeline);
  const categoryGroupTotals: Record<string, number> = {};
  categoryStatsResult.forEach((item: any) => {
    categoryGroupTotals[item.category] = item.count;
  });

  const teamStats = teamStatsResult[0] || { total: 0, statusTotals: {}, severityTotals: {}, categoryTotals: {} };
  teamStats.categoryTotals = teamStats.categoryTotals || {};
  teamStats.categoryGroupTotals = categoryGroupTotals;

  // 4.2 - Detalhes por categoria (padrões distintos) com filtro de patternId válido
  const detailPipeline = [
    { $match: categoryMatch },
    { $group: { _id: { category: "$category", patternId: "$patternId" }, count: { $sum: 1 } } },
    { $project: { _id: 0, category: "$_id.category", patternId: "$_id.patternId", count: 1 } }
  ];
  const detailResults = await Observation.aggregate(detailPipeline);
  const categoryDetails: Record<string, Record<string, number>> = {};
  detailResults.forEach((item: any) => {
    if (!categoryDetails[item.category]) categoryDetails[item.category] = {};
    // Converte patternId para string para usar como chave
    categoryDetails[item.category][item.patternId] = item.count;
  });

  // 🔥 Busca nomes dos patterns - converte IDs para ObjectId
  const allPatternIds = new Set<string>();
  Object.values(categoryDetails).forEach((patterns) => {
    Object.keys(patterns).forEach((id) => allPatternIds.add(id));
  });

  const validObjectIds = Array.from(allPatternIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const patterns = await VulnerabilityPattern.find({ _id: { $in: validObjectIds } }).select('_id name').lean();
  const patternNameMap: Record<string, string> = {};
  patterns.forEach((p: any) => {
    patternNameMap[p._id] = p.name;
  });

  const categoryDetailsWithNames: Record<string, Record<string, number>> = {};
  Object.entries(categoryDetails).forEach(([category, patterns]) => {
    categoryDetailsWithNames[category] = {};
    Object.entries(patterns).forEach(([patternId, count]) => {
      const patternName = patternNameMap[patternId] || patternId; // fallback para o ID se não encontrar
      categoryDetailsWithNames[category][patternName] = count;
    });
  });

  // 5. Stats por Projeto (Grid) - mantém sem filtro de patternId
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

  return NextResponse.json({ teamStats, projectStats, categoryDetails: categoryDetailsWithNames });
}