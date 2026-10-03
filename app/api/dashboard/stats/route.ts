// app/api/dashboard/stats/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import mongoose from "mongoose";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";

interface TeamStatsResponse {
  total: number;
  statusTotals: Record<string, number>;
  severityTotals: Record<string, number>;
  categoryTotals: Record<string, number>;
  categoryGroupTotals: Record<string, number>;
}

/**
 * Estatísticas agregadas do dashboard.
 *
 * Usa `buildObservationFilters` como fonte única de verdade, então os
 * mesmos filtros aplicados aqui são aplicados em `/api/observations` e
 * `/api/stats`. Isso garante que os totais exibidos nos cards batam
 * com os das outras telas para a mesma DBQL + time + janela temporal.
 *
 * Retorna:
 *  - `teamStats`         → total, status, severidade, categorias (individuais e agrupadas)
 *  - `projectStats`      → quebra por projeto (severidade, status, categoria)
 *  - `categoryDetails`   → por categoria, contagem por NOME de pattern
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

  // ============================================================
  // Filtro unificado (DBQL + time + range) — mesma fonte do resto
  // ============================================================
  const { match } = await buildObservationFilters({
    tenantId,
    dbqlId,
    teamId,
    range,
    rangeFrom,
    rangeTo,
  });

  // Universo usado nas agregações por categoria (ignora patternId nulo)
  const categoryMatch = {
    ...match,
    patternId: { $exists: true, $nin: [null, ""] },
  };

  // ============================================================
  // 1. Team stats — severity / status / category (individuais)
  // ============================================================
  const teamPipeline: mongoose.PipelineStage[] = [
    { $match: match },
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

  const teamStats: TeamStatsResponse =
    (teamStatsResult[0] as TeamStatsResponse) ?? {
      total: 0,
      statusTotals: {},
      severityTotals: {},
      categoryTotals: {},
      categoryGroupTotals: {},
    };

  teamStats.statusTotals ??= {};
  teamStats.severityTotals ??= {};
  teamStats.categoryTotals ??= {};
  teamStats.categoryGroupTotals ??= {};

  // Garante mapas consistentes mesmo em tenant vazio
  teamStats.statusTotals = teamStats.statusTotals || {};
  teamStats.severityTotals = teamStats.severityTotals || {};
  teamStats.categoryTotals = teamStats.categoryTotals || {};
  teamStats.categoryGroupTotals = teamStats.categoryGroupTotals || {};

  // ============================================================
  // 2. Grupo — nº de PATTERNS DISTINTOS por categoria
  // ============================================================
  const categoryGroupPipeline: mongoose.PipelineStage[] = [
    { $match: categoryMatch },
    {
      $group: {
        _id: { category: "$category", patternId: "$patternId" },
      },
    },
    {
      $group: {
        _id: "$_id.category",
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, category: "$_id", count: 1 } },
  ];

  const categoryGroupResult = await Observation.aggregate(
    categoryGroupPipeline,
  );
  const categoryGroupTotals: Record<string, number> = {};
  categoryGroupResult.forEach((item: { category: string; count: number }) => {
    categoryGroupTotals[item.category] = item.count;
  });

  const groupedSum = Object.values(categoryGroupTotals).reduce(
    (a, b) => a + b,
    0,
  );
  if (groupedSum === 0) {
    Object.assign(categoryGroupTotals, teamStats.categoryTotals);
  }

  teamStats.categoryGroupTotals = categoryGroupTotals;

  // ============================================================
  // 3. Detalhes — { category: { patternId: count } }
  // ============================================================
  const detailPipeline: mongoose.PipelineStage[] = [
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

  const rawCategoryDetails: Record<string, Record<string, number>> = {};
  detailResults.forEach(
    (item: {
      category: string;
      patternId: mongoose.Types.ObjectId;
      count: number;
    }) => {
      if (!rawCategoryDetails[item.category])
        rawCategoryDetails[item.category] = {};
      rawCategoryDetails[item.category][item.patternId.toString()] = item.count;
    },
  );

  // ============================================================
  // 3.1 — Mapear patternId → patternName
  // ============================================================
  const allPatternIds = new Set<string>();
  Object.values(rawCategoryDetails).forEach((patterns) => {
    Object.keys(patterns).forEach((id) => allPatternIds.add(id));
  });

  const validObjectIds = Array.from(allPatternIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const patternDocs = await VulnerabilityPattern.find({
    _id: { $in: validObjectIds },
  })
    .select("_id dbId name")
    .lean();

  const patternLabelMap = new Map<string, string>();
  patternDocs.forEach((p) => {
    // Prefere `dbId` — chave estável entre ambientes e imune a
    // mudanças cosméticas no `name`. Fallback para `name` cobre
    // patterns não migrados.
    patternLabelMap.set(p._id.toString(), p.dbId ?? p.name ?? p._id.toString());
  });

  const categoryDetails: Record<string, Record<string, number>> = {};
  Object.entries(rawCategoryDetails).forEach(([category, patterns]) => {
    categoryDetails[category] = {};
    Object.entries(patterns).forEach(([patternId, count]) => {
      const label = patternLabelMap.get(patternId) ?? patternId;
      categoryDetails[category][label] = count;
    });
  });

  // ============================================================
  // 4. Stats por projeto
  // ============================================================
  const projectPipeline: mongoose.PipelineStage[] = [
    { $match: match },
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

  const projectStats: Record<
    string,
    {
      total: number;
      severity: Record<string, number>;
      status: Record<string, number>;
      category: Record<string, number>;
    }
  > = {};

  projectStatsData.forEach(
    (item: {
      project: string;
      total: number;
      severityTotals: Record<string, number>;
      statusTotals: Record<string, number>;
      categoryTotals: Record<string, number>;
    }) => {
      projectStats[item.project] = {
        total: item.total,
        severity: item.severityTotals,
        status: item.statusTotals,
        category: item.categoryTotals,
      };
    },
  );

  // ============================================================
  // 5. Resposta
  // ============================================================
  return NextResponse.json({
    teamStats,
    projectStats,
    categoryDetails,
  });
}
