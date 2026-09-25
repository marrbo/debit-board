// lib/observation-filters.ts
import type mongoose from "mongoose";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { Project } from "@/models/Project";
import { Team } from "@/models/Team";
import { parseDBQL } from "./parseDBQL";
import { resolveDbqlString } from "./dbql";
import { normalizeProjectIds } from "./serverUtils";
import { toObjectId } from "./mongo-id";
import { sanitizePreset, sanitizeIso, presetToMillis } from "./range-options";

// Reexport para os componentes que importavam daqui antes.
export {
  RANGE_PRESETS,
  DEFAULT_PRESET,
  type RangePreset,
} from "./range-options";

export interface ObservationFiltersInput {
  tenantId: mongoose.Types.ObjectId;
  dbqlId?: string | null;
  teamId?: string | null;
  /** Preset (`7d`, `30d`, `all`, …). Ignorado quando `rangeFrom` + `rangeTo` válidos. */
  range?: string | null;
  /** ISO. Deve vir acompanhado de `rangeTo`. */
  rangeFrom?: string | null;
  /** ISO. Deve vir acompanhado de `rangeFrom`. */
  rangeTo?: string | null;
}

/**
 * Monta a cláusula `firstSeen` a partir de preset ou range custom.
 *
 * Precedência:
 *  1. `from` + `to` válidos e coerentes (`from < to`) → `$gte` + `$lte`.
 *  2. Preset ≠ `all` → `$gte` calculado a partir de agora.
 *  3. Caso contrário → `null` (sem recorte temporal).
 */
function buildRangeClause(
  range: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): Record<string, unknown> | null {
  const isoFrom = sanitizeIso(from);
  const isoTo = sanitizeIso(to);

  if (isoFrom && isoTo) {
    const gte = new Date(isoFrom);
    const lte = new Date(isoTo);
    if (gte < lte) return { firstSeen: { $gte: gte, $lte: lte } };
  }

  const millis = presetToMillis(sanitizePreset(range));
  if (millis === 0) return null;

  return { firstSeen: { $gte: new Date(Date.now() - millis) } };
}

export async function buildObservationFilters(
  input: ObservationFiltersInput,
): Promise<ObservationFiltersResult> {
  const { tenantId, dbqlId, teamId, range, rangeFrom, rangeTo } = input;

  const rawDbql = (await resolveDbqlString(dbqlId ?? null)) ?? "";
  const patternRes = await resolvePatternNameQuery(rawDbql);
  const allowedProjectNames = await resolveTeamProjectNames(teamId);

  const clauses: Record<string, unknown>[] = [{ tenantId }];

  if (patternRes.patternIdsFilter !== null) {
    clauses.push({ patternId: { $in: patternRes.patternIdsFilter } });
  }

  if (patternRes.cleanedQuery) {
    const parsed = parseDBQL(patternRes.cleanedQuery);
    if (parsed && Object.keys(parsed).length > 0) clauses.push(parsed);
  }

  if (allowedProjectNames !== null) {
    clauses.push({ project: { $in: allowedProjectNames } });
  }

  const rangeClause = buildRangeClause(range, rangeFrom, rangeTo);
  if (rangeClause) clauses.push(rangeClause);

  const match: Record<string, unknown> =
    clauses.length === 1 ? clauses[0] : { $and: clauses };

  return {
    match,
    allowedProjectNames,
    cleanedDbql: patternRes.cleanedQuery,
    patternIdsFilter: patternRes.patternIdsFilter,
  };
}

// ============================================================
// Resolução de `pattern.name:...` na DBQL
// ============================================================

interface PatternResolution {
  /** DBQL sem as cláusulas `pattern.name:X`. */
  cleanedQuery: string;
  /**
   * `null` = não havia `pattern.name` na DBQL (não filtrar por pattern).
   * Array (mesmo vazio) = aplicar `patternId: { $in: [...] }`.
   * Array vazio = DBQL pedia um pattern inexistente → não deve casar nada.
   */
  patternIdsFilter: mongoose.Types.ObjectId[] | null;
}

/**
 * Extrai `pattern.name:"X"` da DBQL e traduz para `VulnerabilityPattern._id`.
 *
 * ⚠️ Limitação conhecida: assume que cada cláusula `pattern.name:X` está no
 * topo da expressão (unida por `AND` implícito). Cláusulas dentro de
 * parênteses com `OR` não são combinadas corretamente — o chamador precisa
 * documentar isso ao usuário. A UI de ajuda já não expõe `pattern.name`.
 */
async function resolvePatternNameQuery(
  query: string,
): Promise<PatternResolution> {
  if (!query || !query.includes("pattern.name")) {
    return { cleanedQuery: query, patternIdsFilter: null };
  }

  const patternRegex = /pattern\.name:(?:"([^"]*)"|(\S+))/gi;
  const patternNames: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = patternRegex.exec(query)) !== null) {
    const value = match[1] ?? match[2];
    if (value) patternNames.push(value);
  }

  if (patternNames.length === 0) {
    return { cleanedQuery: query, patternIdsFilter: null };
  }

  const patterns = await VulnerabilityPattern.find({
    name: { $in: patternNames },
  })
    .select("_id")
    .lean();

  let cleaned = query.replace(patternRegex, "").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^(AND|OR)\s+/i, "").replace(/\s+(AND|OR)$/i, "");

  return {
    cleanedQuery: cleaned,
    patternIdsFilter: patterns.map((p) => p._id),
  };
}

// ============================================================
// Resolução de time → nomes de projeto
// ============================================================

/**
 * Retorna os nomes de projeto permitidos por um `teamId`.
 *
 * - `teamId` nulo ou `"all"` → `null` (sem restrição).
 * - Time válido → lista de nomes (pode ser vazia).
 * - Time inexistente / id inválido → `[]` (nega tudo).
 */
async function resolveTeamProjectNames(
  teamId: string | null | undefined,
): Promise<string[] | null> {
  if (!teamId || teamId === "all") return null;

  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return [];

  const team = await Team.findById(teamObjectId).select("projectIds").lean();
  if (!team) return [];

  const projectIds = normalizeProjectIds(team.projectIds);
  if (projectIds.length === 0) return [];

  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("name")
    .lean();
  return projects.map((p) => p.name);
}

// ============================================================
// API pública
// ============================================================

export interface ObservationFiltersResult {
  /**
   * Match Mongo pronto para `Observation`. Já combina tenant + DBQL +
   * pattern.name + time + range via `$and`, preservando cada filtro
   * mesmo se houver colisão de chaves (ex.: `project` do time + `project`
   * da DBQL).
   */
  match: Record<string, unknown>;
  /** Nomes de projetos permitidos pelo time (`null` = sem restrição). */
  allowedProjectNames: string[] | null;
  /** DBQL original resolvido (sem cláusulas `pattern.name`). */
  cleanedDbql: string;
  /** Resultado da tradução de `pattern.name` (`null` = não havia). */
  patternIdsFilter: mongoose.Types.ObjectId[] | null;
}
