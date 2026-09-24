import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { subDays } from 'date-fns';
import type { PipelineStage } from 'mongoose';
import { getServerSessionIds } from '@/lib/session-server';
import { parseDBQL } from '@/lib/parseDBQL'; // Assumindo que você tem essa lib

/**
 * Lista recursos do endpoint /api/projects/stats.
 *
 * Este endpoint expõe a operação get em /api/projects/stats.
 *
 * @summary Lista recursos do endpoint /api/projects/stats
 * @tags Projects, Stats
 * @route GET /api/projects/stats
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
    const tenantId = sessionIds.tenantId;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '30d';
  const searchQuery = searchParams.get('search') || '';
  const q = searchParams.get('q') || ''; // Pode vir de uma Saved Query

  let baseMatch: any = {};
  if (tenantId) baseMatch.tenantId = tenantId;
  
  if (range === '7d') baseMatch.firstSeen = { $gte: subDays(new Date(), 7) };
  else if (range === '14d') baseMatch.firstSeen = { $gte: subDays(new Date(), 14) };
  else if (range === '30d') baseMatch.firstSeen = { $gte: subDays(new Date(), 30) };

  // Aplicar busca DBQL
  const finalSearch = q || searchQuery;
  if (finalSearch) {
    const parsedMatch = parseDBQL(finalSearch);
    if (parsedMatch && Object.keys(parsedMatch).length > 0) {
      baseMatch = { $and: [baseMatch, parsedMatch] };
    }
  }

  const pipeline: PipelineStage[] = [
    { $match: baseMatch },
    {
      $group: {
        _id: "$project", // 🔥 Agrupa pelo campo 'project' (que é o nome do projeto)
        statuses: { $push: "$status" },
        severities: { $push: "$severity" },
        categories: { $push: "$category" },
      }
    },
    {
      $project: {
        _id: 0,
        project: "$_id", // Nome do projeto
        total: { $size: "$statuses" },
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

  const stats = await Observation.aggregate(pipeline);

  // Converter array para objeto com chave = nome do projeto
  const statsMap: Record<string, any> = {};
  stats.forEach((item: any) => {
    statsMap[item.project] = {
      total: item.total,
      severity: item.severityTotals,
      status: item.statusTotals,
      category: item.categoryTotals,
    };
  });

  return NextResponse.json(statsMap);
}