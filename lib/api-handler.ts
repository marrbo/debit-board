// lib/api-handler.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { parseDBQL } from "@/lib/parseDBQL";
import type { Model, PipelineStage } from "mongoose";
import { requireSession } from "./api-auth";
import { toObjectId } from "./mongo-id";

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
    skipTenantFilter = false, // 🔥 default: comportamento atual
  } = options;

  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);

  await connectToDatabase();

  const { searchParams } = new URL(req.url);

  const searchQuery = overrideSearchQuery || searchParams.get("search") || "";

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const sortField = searchParams.get("sort") || defaultSort;
  const sortOrder = searchParams.get("order") === "asc" ? 1 : -1;

  // Match base
  const baseMatch: Record<string, unknown> = { ...additionalMatch };
  if (tenantId && !skipTenantFilter) {
    baseMatch.tenantId = tenantId;
  }

  let finalMatch: Record<string, unknown>;

  if (searchQuery) {
    try {
      const parsedMatch = parseDBQL(searchQuery);
      if (parsedMatch && Object.keys(parsedMatch).length > 0) {
        const combinedMatch: Record<string, unknown> = { ...baseMatch };
        combinedMatch["$and"] = [baseMatch, parsedMatch];
        finalMatch = combinedMatch;
      } else {
        finalMatch = baseMatch;
      }
    } catch (err) {
      console.error("Erro ao parsear DBQL:", err);
      return NextResponse.json(
        { error: "Invalid DBQL query" },
        { status: 400 },
      );
    }
  } else {
    finalMatch = baseMatch;
  }

  // all=true → ignora paginação
  if (all) {
    const pipeline: PipelineStage[] = [
      { $match: finalMatch },
      ...customPipeline,
      { $sort: { [sortField]: sortOrder } },
      { $project: projection },
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

  // Pipeline com paginação
  const pipeline: PipelineStage[] = [
    { $match: finalMatch },
    ...customPipeline,
    { $sort: { [sortField]: sortOrder } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: projection },
        ],
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
