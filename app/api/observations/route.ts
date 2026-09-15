import { type NextRequest, NextResponse } from "next/server";
import { handleGenericGet } from "@/lib/api-handler";
import { Observation } from "@/models/Observation";
import { SavedQuery } from "@/models/SavedQuery";
import {
  VulnerabilityPattern,
  type IVulnerabilityPattern,
} from "@/models/VulnerabilityPattern";
import { resolveTeamFilter } from "@/lib/team-filter";
import type { IObservation } from "@/types/IObservation";

async function resolvePatternNameQuery(
  query: string,
): Promise<{ cleanedQuery: string; patternIds: any[] } | null> {
  if (!query || !query.includes("pattern.name")) {
    return { cleanedQuery: query, patternIds: [] };
  }

  const patternRegex = /pattern\.name:(?:"([^"]*)"|(\S+))/gi;
  let match: RegExpExecArray | null;
  const patternNames: string[] = [];

  while ((match = patternRegex.exec(query)) !== null) {
    const value = match[1] || match[2];
    if (value) patternNames.push(value);
  }

  if (patternNames.length === 0) return { cleanedQuery: query, patternIds: [] };

  const patterns = await VulnerabilityPattern.find({
    name: { $in: patternNames },
  })
    .select("_id")
    .lean();

  const patternIds = patterns.map((p) => p._id);
  if (patternIds.length === 0) return { cleanedQuery: "", patternIds: [] };

  let cleanedQuery = query.replace(patternRegex, "");
  cleanedQuery = cleanedQuery.replace(/\s+/g, " ").trim();
  cleanedQuery = cleanedQuery
    .replace(/^(AND|OR)\s+/i, "")
    .replace(/\s+(AND|OR)$/i, "");

  return { cleanedQuery, patternIds };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get("q");
  const isAll = searchParams.get("all") === "true";
  const projectId = searchParams.get("projectId");
  const teamId = searchParams.get("teamId");

  let finalSearchQuery = "";
  if (dbqlId) {
    try {
      const savedQuery = await SavedQuery.findById(dbqlId).lean();
      if (savedQuery?.queryString) finalSearchQuery = savedQuery.queryString;
    } catch (error) {
      console.error("Erro ao buscar SavedQuery:", error);
      return NextResponse.json(
        { error: "Erro ao carregar saved query" },
        { status: 500 },
      );
    }
  }

  // 🔥 Filtros de projeto — agrega em $and se houver mais de um
  const projectFilters: Record<string, unknown>[] = [];

  if (projectId && projectId !== "all") {
    projectFilters.push({ project: projectId });
  }

  const { allowedProjectNames } = await resolveTeamFilter(teamId);
  if (allowedProjectNames !== null) {
    projectFilters.push({ project: { $in: allowedProjectNames } });
  }

  const additionalMatch: Record<string, unknown> = {};
  if (projectFilters.length === 1) {
    Object.assign(additionalMatch, projectFilters[0]);
  } else if (projectFilters.length > 1) {
    additionalMatch.$and = projectFilters;
  }

  const patternResolution = await resolvePatternNameQuery(finalSearchQuery);
  if (patternResolution) {
    finalSearchQuery = patternResolution.cleanedQuery;
    if (patternResolution.patternIds.length > 0) {
      additionalMatch.patternId = { $in: patternResolution.patternIds };
    }
  }

  try {
    const result = await handleGenericGet(req, {
      model: Observation,
      defaultSort: "firstSeen",
      additionalMatch,
      overrideSearchQuery: finalSearchQuery,
      projection: {
        _id: 1, fileName: 1, filePath: 1, category: 1,
        patternId: 1, branch: 1, severity: 1, status: 1, slaDueAt: 1,
        assignedTo: 1, hitCount: 1, project: 1, repository: 1,
        firstSeen: 1, lastSeen: 1,
      },
      all: isAll,
    });

    const responseData = await result.json();
    const observations: IObservation[] = Array.isArray(responseData)
      ? responseData
      : responseData.data || [];

    if (observations.length > 0) {
      const patternIds = observations
        .map((o) => o.patternId)
        .filter((id): id is NonNullable<typeof id> => id != null);

      if (patternIds.length > 0) {
        const patterns = await VulnerabilityPattern.find({
          _id: { $in: patternIds },
        })
          .select(
            "_id name description recommendation score severity category externalId externalLink",
          )
          .lean();

        const patternMap = new Map(
          patterns.map((p: IVulnerabilityPattern) => [p._id.toString(), p]),
        );

        observations.forEach((obs) => {
          const pattern = patternMap.get(obs.patternId?.toString());
          if (pattern) {
            obs.patternName = pattern.name;
            obs.description = pattern.description;
            obs.recommendation = pattern.recommendation;
            obs.pattern = pattern;
          } else {
            obs.patternName = "";
            obs.description = "";
            obs.recommendation = "";
            obs.pattern = null;
          }
        });
      } else {
        observations.forEach((obs) => {
          obs.patternName = "";
          obs.description = "";
          obs.recommendation = "";
        });
      }
    }

    if (Array.isArray(responseData)) {
      return NextResponse.json({ data: observations, total: observations.length });
    }
    return NextResponse.json({ ...responseData, data: observations });
  } catch (error) {
    console.error("Erro ao buscar observations:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar observations" },
      { status: 500 },
    );
  }
}