// app/api/dashboard/route.ts
import { type NextRequest } from "next/server";
import { Project } from "@/models/Project";
import { Observation } from "@/models/Observation";
import mongoose from "mongoose";
import { handleGenericGet } from "@/lib/api-handler";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import { buildObservationFilters } from "@/lib/observation-filters";
import {
  sanitizePreset,
  sanitizeIso,
  DEFAULT_PRESET,
} from "@/lib/range-options";

/**
 * Lista projetos do dashboard respeitando time, DBQL e janela temporal.
 *
 * A janela temporal pode ser um preset (`?range=30d`) ou um intervalo
 * custom (`?from=ISO&to=ISO`). Quando o range é restritivo **ou** há DBQL,
 * o grid é limitado aos projetos que possuem observations casando com o
 * filtro completo — os mesmos considerados em `/api/observations` e
 * `/api/dashboard/stats`.
 *
 * @summary Lista projetos do dashboard
 * @tags Dashboard
 * @route GET /api/dashboard
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP.
 * @returns Resposta JSON `{ data, total, page, limit, totalPages }`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const dbqlId = searchParams.get("q");

  const rawRange = searchParams.get("range");
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");

  // Sanitiza aqui só para decidir se há filtro restritivo. O match em si
  // é montado por `buildObservationFilters`, que sanitiza de novo.
  const range = sanitizePreset(rawRange);
  const from = sanitizeIso(rawFrom);
  const to = sanitizeIso(rawTo);
  const hasCustomRange = Boolean(from && to);
  const hasRestrictiveFilter =
    Boolean(dbqlId && dbqlId.length > 0) ||
    hasCustomRange ||
    range !== DEFAULT_PRESET;

  const { match, allowedProjectNames } = await buildObservationFilters({
    tenantId,
    dbqlId,
    teamId,
    range: rawRange,
    rangeFrom: rawFrom,
    rangeTo: rawTo,
  });

  // Se há filtro restritivo (DBQL ou range), restringe pelo conjunto de
  // projetos que TÊM observations casando. Sem isso, projetos vazios
  // ficariam no grid mostrando 0 enquanto o stat card mostraria 0 também
  // — divergência silenciosa para o usuário.
  let allowedProjectIds: mongoose.Types.ObjectId[] | null = null;

  if (hasRestrictiveFilter) {
    const names = await Observation.distinct("project", match);
    const projects = await Project.find({
      tenantId,
      name: { $in: names },
    })
      .select("_id")
      .lean();
    allowedProjectIds = projects.map((p) => p._id);
  } else if (allowedProjectNames !== null) {
    // Apenas time selecionado: devolve todos os projetos do time
    // (mesmo os sem observations), preservando o comportamento anterior.
    const projects = await Project.find({
      tenantId,
      name: { $in: allowedProjectNames },
    })
      .select("_id")
      .lean();
    allowedProjectIds = projects.map((p) => p._id);
  }

  return handleGenericGet(req, {
    model: Project,
    defaultSort: "name",
    all: true,
    additionalMatch:
      allowedProjectIds !== null ? { _id: { $in: allowedProjectIds } } : {},
    skipDbqlParsing: true,
  });
}
