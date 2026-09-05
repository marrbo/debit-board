import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { subDays } from 'date-fns';
import type { PipelineStage } from 'mongoose';
import { getServerSessionIds } from '@/lib/session-server';

export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = req.headers.get('x-tenant-id') || sessionIds.tenantId;
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const range = searchParams.get('range') || '30d';

  await connectToDatabase();

  let projectNames: string[] | null = null;

  if (teamId && teamId !== 'all') {
    const team = await Team.findById(teamId).lean();
    if (!team) return NextResponse.json({ message: 'Team não encontrado' }, { status: 404 });

    // Se for Global, pega tudo
    if (team.isGlobal) {
      projectNames = null; 
    } else {
      // Busca os nomes dos projetos do time
      const teamProjects = await Project.find({ _id: { $in: team.projectIds } })
        .select('name')
        .lean();

      projectNames = teamProjects.map(p => p.name);
      
      // Se o array estiver vazio, o $in: [] retornará 0 naturalmente
    }
  }

  const baseMatch: any = { tenantId };

  if (projectNames) {
    baseMatch.project = { $in: projectNames };
  }

  if (range === '7d') baseMatch.firstSeen = { $gte: subDays(new Date(), 7) };
  else if (range === '14d') baseMatch.firstSeen = { $gte: subDays(new Date(), 14) };
  else if (range === '30d') baseMatch.firstSeen = { $gte: subDays(new Date(), 30) };

  const pipeline: PipelineStage[] = [
    { $match: baseMatch },
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
        statusTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$statuses" },
              as: "st",
              in: {
                k: "$$st",
                v: { $size: { $filter: { input: "$statuses", as: "sta", cond: { $eq: ["$$sta", "$$st"] } } } }
              }
            }
          }
        },
        severityTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$severities" },
              as: "sev",
              in: {
                k: "$$sev",
                v: { $size: { $filter: { input: "$severities", as: "s", cond: { $eq: ["$$s", "$$sev"] } } } }
              }
            }
          }
        },
        categoryTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$categories" },
              as: "cat",
              in: {
                k: "$$cat",
                v: { $size: { $filter: { input: "$categories", as: "c", cond: { $eq: ["$$c", "$$cat"] } } } }
              }
            }
          }
        }
      }
    }
  ];

  const result = await Observation.aggregate(pipeline);
  const stats = result[0] || { total: 0, statusTotals: {}, severityTotals: {}, categoryTotals: {} };

  return NextResponse.json(stats);
}