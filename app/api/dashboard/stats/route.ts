// app/api/dashboard/stats/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import mongoose from "mongoose";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";

/**
 * Estatísticas agregadas do dashboard (cards + tabela).
 *
 * Aceita `range=7d|14d|30d|90d|all` (preset) **ou** `from` + `to` (ISO,
 * custom). Quando ambos vêm preenchidos, `from`/`to` têm precedência.
 *
 * Aplica exatamente o mesmo filtro de `/api/observations` via
 * `buildObservationFilters`, garantindo que o total mostrado aqui
 * bata com o total da tela de Observations para a mesma DBQL + time + range.
 *
 * @summary Stats agregados do dashboard
 * @tags Dashboard, Stats
 * @route GET /api/dashboard/stats
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP.
 * @returns {Promise<NextResponse>} `{ teamStats, projectStats, categoryDetails }`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const dbqlId = searchParams.get("q");
  const range = searchParams.get("range");
  const rangeFrom = searchParams.get("from");
  const rangeTo = searchParams.get("to");

  const { match: obsMatch } = await buildObservationFilters({
    tenantId,
    dbqlId,
    teamId,
    range,
    rangeFrom,
    rangeTo,
  });

  const categoryMatch = {
    ...obsMatch,
    patternId: { $exists: true, $nin: [null, ""] },
  };

  // ---------- 1. Team stats ----------
  const teamPipeline: any[] = [
    { $match: obsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        statuses: { $push: "$status" },
        severities: { $push: "$severity" },
        categories: { $push: "$category" },
      },
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
                v: {
                  $size: {
                    $filter: {
                      input: "$statuses",
                      as: "sta",
                      cond: { $eq: ["$$sta", "$$st"] },
                    },
                  },
                },
              },
            },
          },
        },
        severityTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$severities" },
              as: "sev",
              in: {
                k: "$$sev",
                v: {
                  $size: {
                    $filter: {
                      input: "$severities",
                      as: "s",
                      cond: { $eq: ["$$s", "$$sev"] },
                    },
                  },
                },
              },
            },
          },
        },
        categoryTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$categories" },
              as: "cat",
              in: {
                k: "$$cat",
                v: {
                  $size: {
                    $filter: {
                      input: "$categories",
                      as: "c",
                      cond: { $eq: ["$$c", "$$cat"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const teamStatsResult = await Observation.aggregate(teamPipeline);

  const categoryPipeline = [
    { $match: categoryMatch },
    { $group: { _id: { category: "$category", patternId: "$patternId" } } },
    { $group: { _id: "$_id.category", count: { $sum: 1 } } },
    { $project: { _id: 0, category: "$_id", count: 1 } },
  ];

  const categoryStatsResult = await Observation.aggregate(categoryPipeline);
  const categoryGroupTotals: Record<string, number> = {};
  categoryStatsResult.forEach((item: any) => {
    categoryGroupTotals[item.category] = item.count;
  });

  const teamStats = teamStatsResult[0] || {
    total: 0,
    statusTotals: {},
    severityTotals: {},
    categoryTotals: {},
  };
  teamStats.categoryTotals = teamStats.categoryTotals || {};
  teamStats.categoryGroupTotals = categoryGroupTotals;

  const detailPipeline = [
    { $match: categoryMatch },
    {
      $group: {
        _id: { category: "$category", patternId: "$patternId" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id.category",
        patternId: "$_id.patternId",
        count: 1,
      },
    },
  ];
  const detailResults = await Observation.aggregate(detailPipeline);
  const categoryDetails: Record<string, Record<string, number>> = {};
  detailResults.forEach((item: any) => {
    if (!categoryDetails[item.category]) categoryDetails[item.category] = {};
    categoryDetails[item.category][item.patternId] = item.count;
  });

  const allPatternIds = new Set<string>();
  Object.values(categoryDetails).forEach((patterns) => {
    Object.keys(patterns).forEach((id) => allPatternIds.add(id));
  });

  const validObjectIds = Array.from(allPatternIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const patterns = await VulnerabilityPattern.find({
    _id: { $in: validObjectIds },
  })
    .select("_id name")
    .lean();

  const patternNameMap: Record<string, string> = {};
  patterns.forEach((p: any) => {
    patternNameMap[p._id] = p.name;
  });

  const categoryDetailsWithNames: Record<string, Record<string, number>> = {};
  Object.entries(categoryDetails).forEach(([category, patterns]) => {
    categoryDetailsWithNames[category] = {};
    Object.entries(patterns).forEach(([patternId, count]) => {
      const patternName = patternNameMap[patternId] || patternId;
      categoryDetailsWithNames[category][patternName] = count;
    });
  });

  const projectPipeline: any[] = [
    { $match: obsMatch },
    {
      $group: {
        _id: "$project",
        statuses: { $push: "$status" },
        severities: { $push: "$severity" },
        categories: { $push: "$category" },
      },
    },
    {
      $project: {
        _id: 0,
        project: "$_id",
        total: { $size: "$statuses" },
        statusTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$statuses" },
              as: "st",
              in: {
                k: "$$st",
                v: {
                  $size: {
                    $filter: {
                      input: "$statuses",
                      as: "sta",
                      cond: { $eq: ["$$sta", "$$st"] },
                    },
                  },
                },
              },
            },
          },
        },
        severityTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$severities" },
              as: "sev",
              in: {
                k: "$$sev",
                v: {
                  $size: {
                    $filter: {
                      input: "$severities",
                      as: "s",
                      cond: { $eq: ["$$s", "$$sev"] },
                    },
                  },
                },
              },
            },
          },
        },
        categoryTotals: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$categories" },
              as: "cat",
              in: {
                k: "$$cat",
                v: {
                  $size: {
                    $filter: {
                      input: "$categories",
                      as: "c",
                      cond: { $eq: ["$$c", "$$cat"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
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

  return NextResponse.json({
    teamStats,
    projectStats,
    categoryDetails: categoryDetailsWithNames,
  });
}
