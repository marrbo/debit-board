// lib/api-handler.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { parseDBQL } from "@/lib/parseDBQL";
import type { Model, PipelineStage } from "mongoose";
import { requireSession } from "./api-auth";
import { toObjectId } from "./mongo-id";
import { resolveDbqlString } from "./dbql";

interface ProjectionObject {
  [key: string]: ProjectionValue;
}
type ProjectionValue = string | number | boolean | ProjectionObject;

interface FacetResult<T> {
  data: T[];
  total: { count: number }[];
}

interface GenericGetOptions<T> {
  model: Model<T | any>;
  defaultSort?: string;
  projection?: Record<string, ProjectionValue>;
  customPipeline?: PipelineStage[];
  additionalMatch?: Record<string, unknown>;
  overrideSearchQuery?: string;
  all?: boolean;
  /** 🔥 Recursos globais (ex.: VulnerabilityPattern) não possuem tenantId. */
  skipTenantFilter?: boolean;
  /**
   * 🔥 Quando `true`, o handler não tenta resolver nem aplicar DBQL —
   * útil quando o endpoint já traduziu o `q` para um filtro concreto
   * (ex.: `/api/dashboard` converte DBQL em `Project._id` antes).
   */
  skipDbqlParsing?: boolean;
}

export async function handleGenericGet<T>(
  req: NextRequest,
  options: GenericGetOptions<T>,
) {
  const {
    model,
    defaultSort = "createdAt",
    projection = {},
    customPipeline = [],
    additionalMatch = {},
    overrideSearchQuery,
    all = false,
    skipTenantFilter = false,
    skipDbqlParsing = false,
  } = options;

  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);

  await connectToDatabase();

  const { searchParams } = new URL(req.url);

  const savedQueryId = searchParams.get("q") || "";

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const sortField = searchParams.get("sort") || defaultSort;
  const sortOrder = searchParams.get("order") === "asc" ? 1 : -1;

  // Match base
  const baseMatch: Record<string, unknown> = { ...additionalMatch };
  if (tenantId && !skipTenantFilter) {
    baseMatch.tenantId = tenantId;
  }

  let finalMatch: Record<string, unknown> = baseMatch;

  // 🔑 `overrideSearchQuery` pode vir sem `q` na URL (ex.: /api/sast/scans)
  if (!skipDbqlParsing && (savedQueryId || overrideSearchQuery)) {
    try {
      const queryString =
        overrideSearchQuery || (await resolveDbqlString(savedQueryId)) || "";

      if (queryString) {
        const parsedMatch = parseDBQL(queryString);
        if (parsedMatch && Object.keys(parsedMatch).length > 0) {
          finalMatch = {
            ...baseMatch,
            $and: [baseMatch, parsedMatch],
          };
        }
      }
    } catch (err) {
      console.error("Erro ao parsear DBQL:", err);
      return NextResponse.json(
        { error: "Invalid DBQL query" },
        { status: 400 },
      );
    }
  }

  // 🔥 MongoDB rejeita `$project: {}`. Só adiciona quando há campos.
  const projectionStage: PipelineStage.FacetPipelineStage[] =
    Object.keys(projection).length > 0
      ? [{ $project: projection } satisfies PipelineStage.FacetPipelineStage]
      : [];

  // all=true → ignora paginação
  if (all) {
    const pipeline: PipelineStage[] = [
      { $match: finalMatch },
      ...customPipeline,
      { $sort: { [sortField]: sortOrder } },
      ...projectionStage,
    ];

    const allData = await model.aggregate<T[]>(pipeline);
    return NextResponse.json({
      data: allData,
      total: allData.length,
      page: 1,
      limit: allData.length,
      totalPages: 1,
    });
  }

  // 🔑 Sub-pipeline do `$facet.data` precisa ser `FacetPipelineStage[]`,
  //    que exclui `$collStats` / `$out` / `$geoNear` (inválidos dentro de facet).
  const dataStages: PipelineStage.FacetPipelineStage[] = [
    { $skip: (page - 1) * limit },
    { $limit: limit },
    ...projectionStage,
  ];

  // Pipeline com paginação
  const pipeline: PipelineStage[] = [
    { $match: finalMatch },
    ...customPipeline,
    { $sort: { [sortField]: sortOrder } },
    {
      $facet: {
        data: dataStages,
        total: [{ $count: "count" }],
      },
    },
  ];

  const results = await model.aggregate<FacetResult<T>>(pipeline);

  if (!results || results.length === 0) {
    return NextResponse.json({
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    });
  }

  const result = results[0];
  const data = result.data ?? [];
  const totalArray = result.total;
  const totalCount =
    totalArray && totalArray.length > 0 ? totalArray[0].count : 0;

  return NextResponse.json({
    data,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  });
}
