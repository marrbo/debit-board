// lib/ai/live-context.ts
import { Team } from "@/models/Team";
import { Project } from "@/models/Project";
import { Observation } from "@/models/Observation";
import AiEmbedding from "@/models/AiEmbedding";
import { connectToDatabase } from "@/lib/mongodb";
import { tokenize } from "./text";

const SNAPSHOT_END = "\n\n_[[FIM]]_";

/**
 * Envolve um snapshot em tags que instruem o LLM sobre o que copiar
 * literalmente (`[[COPY]]`) e onde a interpretação é permitida (`[[ANALYZE]]`).
 *
 * O bloco `[[ANALYZE]]` é opcional: o system prompt orienta o modelo a
 * ignorá-lo quando o usuário não pediu análise.
 */
function wrapSnapshot(snapshot: string): string {
  const clean = snapshot.replace(/\n\n_\[\[FIM\]\]_\s*$/, "").trimEnd();
  return [
    "[[COPY]]",
    clean,
    "[[/COPY]]",
    "",
    "[[ANALYZE]]",
    "(opcional: se e somente se o usuário pedir análise, adicione UMA frase interpretativa aqui, baseada apenas na tabela acima)",
    "[[/ANALYZE]]",
  ].join("\n");
}

// ============================================================
// Cache em memória (60s)
// ============================================================
interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: string): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

// ============================================================
// Fuzzy matching
// ============================================================
const ACCENTS = /[\u0300-\u036f]/g;
const NON_WORD = /[^\w\s]/g;
const SPACES = /\s+/g;

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4) return false;
  const tol = maxLen <= 6 ? 1 : maxLen <= 10 ? 2 : 3;
  if (Math.abs(a.length - b.length) > tol) return false;
  return lev(a, b) <= tol;
}

function containsPhrase(tokens: string[], phrase: string): boolean {
  const p = tokenize(phrase);
  if (p.length === 0) return false;
  for (let i = 0; i <= tokens.length - p.length; i++) {
    let all = true;
    for (let j = 0; j < p.length; j++) {
      if (!closeEnough(tokens[i + j], p[j])) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

// ============================================================
// Classificação de intenção
// ============================================================
interface IntentRule {
  name: string;
  phrases: string[];
}

const RULES: IntentRule[] = [
  {
    name: "api_endpoints",
    phrases: [
      "quais endpoints",
      "quais rotas",
      "que rotas",
      "listar endpoints",
      "listar rotas",
      "endpoints da api",
      "rotas da api",
      "documentacao da api",
      "swagger",
      "openapi",
      "como chamo a api",
      "qual o metodo http",
    ],
  },
  {
    name: "all_teams",
    phrases: [
      "todos os times",
      "quais times",
      "quais os times",
      "ranking de times",
      "ranking dos times",
      "compare os times",
      "comparar os times",
      "comparativo dos times",
      "comparativo entre times",
      "entre os times",
      "por time",
    ],
  },
  {
    name: "stats",
    phrases: [
      "stats",
      "estatisticas",
      "evolucao",
      "tendencia",
      "ao longo do tempo",
      "linha do tempo",
      "ultimos dias",
      "ultimos meses",
      "ultimas semanas",
    ],
  },
  {
    name: "exec",
    phrases: [
      "resumo executivo",
      "executive summary",
      "dashboard executivo",
      "resumo de seguranca",
      "resumo geral",
      "visao geral",
      "panorama",
      "overview",
      "dashboard",
    ],
  },
  {
    name: "top_patterns",
    phrases: [
      "top padroes",
      "padroes de deteccao",
      "principais padroes",
      "subcategorias",
      "categorias individuais",
    ],
  },
  {
    name: "top_categories",
    phrases: [
      "top categorias",
      "principais categorias",
      "maiores categorias",
      "categorias mais",
      "distribuicao por categoria",
    ],
  },
  {
    name: "top_projects",
    phrases: [
      "top projetos",
      "projetos mais",
      "projetos afetados",
      "ranking de projetos",
    ],
  },
  {
    name: "top_repos",
    phrases: [
      "top repositorios",
      "repositorios mais",
      "ranking de repositorios",
    ],
  },
  {
    name: "data_intent",
    phrases: [
      "quantas observations",
      "quantas criticas",
      "quantas abertas",
      "qual o total",
      "estado atual",
      "situacao atual",
      "quantos problemas",
    ],
  },
];

function classify(tokens: string[]): string | null {
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (containsPhrase(tokens, phrase)) return rule.name;
    }
  }
  return null;
}

function extractTopN(tokens: string[], def = 5): number {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === "top") {
      const n = Number(tokens[i + 1]);
      if (Number.isInteger(n) && n > 0) return Math.min(n, 50);
    }
  }
  return def;
}

function extractTimeRange(norm: string): number {
  const m = norm.match(
    /(?:ultimos?|ultimas?|proximos?|proximas?)\s+(\d+)\s+(dias?|semanas?|meses?|mes)/,
  );
  if (!m) return 30;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit.startsWith("semana")) return n * 7;
  if (unit.startsWith("mes")) return n * 30;
  return n;
}

function extractStatusFilter(tokens: string[]): string | undefined {
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "open") ||
        closeEnough(t, "abertas") ||
        closeEnough(t, "aberta"),
    )
  )
    return "open";
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "resolved") ||
        closeEnough(t, "resolvidas") ||
        closeEnough(t, "resolvida") ||
        closeEnough(t, "corrigidas"),
    )
  )
    return "resolved";
  if (
    tokens.some(
      (t) => closeEnough(t, "recurring") || closeEnough(t, "recorrentes"),
    )
  )
    return "recurring";
  if (tokens.some((t) => closeEnough(t, "wont_fix"))) return "wont_fix";
  if (
    tokens.some((t) => closeEnough(t, "expired") || closeEnough(t, "expiradas"))
  )
    return "expired";
  return undefined;
}

function extractSeverityFilter(tokens: string[]): string | undefined {
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "critical") ||
        closeEnough(t, "critica") ||
        closeEnough(t, "criticas"),
    )
  )
    return "critical";
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "high") ||
        closeEnough(t, "alta") ||
        closeEnough(t, "altas"),
    )
  )
    return "high";
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "medium") ||
        closeEnough(t, "media") ||
        closeEnough(t, "medias"),
    )
  )
    return "medium";
  if (
    tokens.some(
      (t) =>
        closeEnough(t, "low") ||
        closeEnough(t, "baixa") ||
        closeEnough(t, "baixas"),
    )
  )
    return "low";
  return undefined;
}

const HTTP_METHOD_WORDS: Record<string, string> = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
  head: "HEAD",
  options: "OPTIONS",
};

function extractHttpMethod(tokens: string[]): string | undefined {
  for (const t of tokens) {
    const m = HTTP_METHOD_WORDS[t];
    if (m) return m;
  }
  return undefined;
}

async function extractApiTag(tokens: string[]): Promise<string | undefined> {
  const idx = tokens.findIndex((t) => closeEnough(t, "tag"));
  if (idx === -1 || idx + 1 >= tokens.length) return undefined;
  const candidate = tokens[idx + 1];

  const docs = await AiEmbedding.find({ source: "openapi" })
    .select("metadata.tags")
    .lean();

  const allTags = new Set<string>();
  for (const d of docs) {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const tags = meta.tags;
    if (Array.isArray(tags)) {
      for (const t of tags) if (typeof t === "string") allTags.add(t);
    }
  }

  for (const tag of allTags) {
    if (closeEnough(candidate, tag.toLowerCase())) return tag;
  }
  return undefined;
}

// ============================================================
// Filtro → Mongo
// ============================================================
interface Filter {
  teamName?: string;
  projectNames?: string[];
  status?: string;
  severity?: string;
  since?: Date;
}

interface ResolvedFilter {
  mongo: Record<string, unknown>;
  label: string;
}

async function resolveFilter(
  f: Filter,
  includeTeamInLabel = true,
): Promise<ResolvedFilter> {
  const mongo: Record<string, unknown> = {};
  const parts: string[] = [];

  if (f.teamName) {
    const team = await Team.findOne({ name: f.teamName }).lean();
    if (team) {
      const projects = await Project.find({ teamId: team._id })
        .select("name")
        .lean();
      mongo.project = { $in: projects.map((p) => p.name) };
      if (includeTeamInLabel) parts.push(`time \`${f.teamName}\``);
    }
  } else if (f.projectNames?.length) {
    mongo.project = { $in: f.projectNames };
    parts.push(`projeto(s) \`${f.projectNames.join(", ")}\``);
  }

  if (f.status) {
    mongo.status = f.status;
    parts.push(`status \`${f.status}\``);
  }
  if (f.severity) {
    mongo.severity = f.severity;
    parts.push(`severidade \`${f.severity}\``);
  }
  if (f.since) {
    mongo.firstSeen = { $gte: f.since };
    parts.push(`desde ${f.since.toISOString().slice(0, 10)}`);
  }

  return { mongo, label: parts.length ? ` (${parts.join(", ")})` : "" };
}

// ============================================================
// Primitivas de agregação
// ============================================================
async function countBySeverity(
  match: Record<string, unknown>,
): Promise<Record<string, number>> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);
  const out: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const r of rows) {
    if (r._id) out[r._id] = r.count;
  }
  return out;
}

async function countByStatus(
  match: Record<string, unknown>,
): Promise<Record<string, number>> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const out: Record<string, number> = {
    open: 0,
    resolved: 0,
    recurring: 0,
    wont_fix: 0,
    expired: 0,
  };
  for (const r of rows) {
    if (r._id) out[r._id] = r.count;
  }
  return out;
}

async function topCategories(
  match: Record<string, unknown>,
  limit = 8,
): Promise<{ category: string; count: number; patterns: number }[]> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        patternSet: { $addToSet: "$patternId" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        category: "$_id",
        count: 1,
        patterns: { $size: "$patternSet" },
      },
    },
  ]);
  return rows as { category: string; count: number; patterns: number }[];
}

async function topPatterns(
  match: Record<string, unknown>,
  limit = 8,
): Promise<{ pattern: string; category: string; count: number }[]> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$patternId",
        category: { $first: "$category" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "vulnerabilitypatterns",
        localField: "_id",
        foreignField: "_id",
        as: "patternDoc",
      },
    },
    {
      $project: {
        _id: 0,
        pattern: {
          $ifNull: [
            { $arrayElemAt: ["$patternDoc.name", 0] },
            "(padrão desconhecido)",
          ],
        },
        category: 1,
        count: 1,
      },
    },
  ]);
  return rows as { pattern: string; category: string; count: number }[];
}

async function topProjects(
  match: Record<string, unknown>,
  limit = 10,
): Promise<
  {
    project: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }[]
> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$project",
        total: { $sum: 1 },
        critical: {
          $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] },
        },
        high: { $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] } },
        medium: {
          $sum: { $cond: [{ $eq: ["$severity", "medium"] }, 1, 0] },
        },
        low: { $sum: { $cond: [{ $eq: ["$severity", "low"] }, 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        project: "$_id",
        total: 1,
        critical: 1,
        high: 1,
        medium: 1,
        low: 1,
      },
    },
  ]);
  return rows as any;
}

async function topRepositories(
  match: Record<string, unknown>,
  limit = 8,
): Promise<{ repository: string; count: number }[]> {
  const rows = await Observation.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $match: { repository: { $exists: true, $ne: null } } },
    { $group: { _id: "$repository", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, repository: "$_id", count: 1 } },
  ]);
  return rows as { repository: string; count: number }[];
}

async function timeline(
  match: Record<string, unknown>,
  days = 30,
): Promise<{ date: string; count: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await Observation.aggregate([
    { $match: { ...match, firstSeen: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ]);
  return rows as { date: string; count: number }[];
}

// ============================================================
// Snapshots
// ============================================================
async function getTeamExecutive(
  teamName: string,
  limit = 8,
): Promise<string | null> {
  const key = `exec:${teamName}:${limit}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo } = await resolveFilter({ teamName }, false);
  if (!mongo.project) return null;

  const [total, sev, st, grouped, patterns, projects] = await Promise.all([
    Observation.countDocuments(mongo),
    countBySeverity(mongo),
    countByStatus(mongo),
    topCategories(mongo, limit),
    topPatterns(mongo, limit),
    topProjects(mongo, 5),
  ]);

  const pct = (n: number) =>
    total > 0 ? ` (${((n / total) * 100).toFixed(1)}%)` : "";

  const groupedRows = grouped
    .map((c) => `| ${c.category} | ${c.count} | ${c.patterns} |`)
    .join("\n");
  const patternRows = patterns
    .map((p) => `| ${p.pattern} | ${p.category} | ${p.count} |`)
    .join("\n");
  const projectRows = projects
    .map(
      (p) =>
        `| ${p.project} | ${p.total} | ${p.critical} | ${p.high} | ${p.medium} | ${p.low} |`,
    )
    .join("\n");

  const out = [
    `# Resumo Executivo — Time ${teamName}`,
    ``,
    `## Severidade e status`,
    ``,
    `| Time | Total | Críticas | Altas | Médias | Baixas | Abertas | Corrigidas | Recorrentes | Não corrigir |`,
    `|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
    `| **${teamName}** | ${total} | ${sev.critical}${pct(sev.critical)} | ${sev.high}${pct(sev.high)} | ${sev.medium}${pct(sev.medium)} | ${sev.low}${pct(sev.low)} | ${st.open} | ${st.resolved} | ${st.recurring} | ${st.wont_fix} |`,
    ``,
    `## Distribuição por categoria`,
    ``,
    `| Categoria | Observations | Padrões distintos |`,
    `|---|---:|---:|`,
    groupedRows || "| _(sem dados)_ | 0 | 0 |",
    ``,
    `## Distribuição por padrão de detecção`,
    ``,
    `| Padrão | Categoria | Observations |`,
    `|---|---|---:|`,
    patternRows || "| _(sem dados)_ | — | 0 |",
    ``,
    `## Projetos vinculados`,
    ``,
    `| Projeto | Total | Críticas | Altas | Médias | Baixas |`,
    `|---|---:|---:|---:|---:|---:|`,
    projectRows || "| _(sem dados)_ | 0 | 0 | 0 | 0 | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

async function getTeamStats(
  teamName: string,
  days = 30,
): Promise<string | null> {
  const key = `stats:${teamName}:${days}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo, label } = await resolveFilter({ teamName }, false);
  if (!mongo.project) return null;

  const [total, sev, st, grouped, byProject, time] = await Promise.all([
    Observation.countDocuments(mongo),
    countBySeverity(mongo),
    countByStatus(mongo),
    topCategories(mongo, 8),
    topProjects(mongo, 10),
    timeline(mongo, days),
  ]);

  const groupedRows = grouped
    .map((c) => `| ${c.category} | ${c.count} |`)
    .join("\n");
  const projectRows = byProject
    .map((p) => `| ${p.project} | ${p.total} | ${p.critical} | ${p.high} |`)
    .join("\n");

  const step = Math.max(1, Math.ceil(time.length / 8));
  const timelineRows = time
    .filter((_, i) => i % step === 0)
    .map((t) => `| ${t.date} | ${t.count} |`)
    .join("\n");

  const out = [
    `# Stats & Usage — Time ${teamName}${label} (últimos ${days} dias)`,
    ``,
    `## Resumo`,
    ``,
    `| Métrica | Valor |`,
    `|---|---:|`,
    `| Total de observations | ${total} |`,
    `| Críticas | ${sev.critical} |`,
    `| Altas | ${sev.high} |`,
    `| Médias | ${sev.medium} |`,
    `| Baixas | ${sev.low} |`,
    `| Abertas | ${st.open} |`,
    `| Corrigidas | ${st.resolved} |`,
    ``,
    `## Distribuição por categoria`,
    ``,
    `| Categoria | Observations |`,
    `|---|---:|`,
    groupedRows || "| _(sem dados)_ | 0 |",
    ``,
    `## Top 10 projetos`,
    ``,
    `| Projeto | Total | Críticas | Altas |`,
    `|---|---:|---:|---:|`,
    projectRows || "| _(sem dados)_ | 0 | 0 | 0 |",
    ``,
    `## Novas ocorrências ao longo do tempo`,
    ``,
    `| Data | Novas |`,
    `|---|---:|`,
    timelineRows || "| _(nenhuma nova no período)_ | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

interface TeamRow {
  name: string;
  total: number;
  critical: number;
  high: number;
  open: number;
  resolved: number;
}

async function getAllTeamsComparison(): Promise<string> {
  const cached = getCached("__all-teams__");
  if (cached) return cached;

  const teams = await Team.find({ isGlobal: { $ne: true } }).lean();

  const rows: TeamRow[] = [];

  for (const team of teams) {
    const projects = await Project.find({ teamId: team._id })
      .select("name")
      .lean();
    const names = projects.map((p) => p.name);

    if (names.length === 0) {
      rows.push({
        name: team.name,
        total: 0,
        critical: 0,
        high: 0,
        open: 0,
        resolved: 0,
      });
      continue;
    }

    const mongo = { project: { $in: names } };
    const [total, sev, st] = await Promise.all([
      Observation.countDocuments(mongo),
      countBySeverity(mongo),
      countByStatus(mongo),
    ]);

    rows.push({
      name: team.name,
      total,
      critical: sev.critical,
      high: sev.high,
      open: st.open,
      resolved: st.resolved,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  const tableRows = rows
    .map(
      (r) =>
        `| ${r.name} | ${r.total} | ${r.critical} | ${r.high} | ${r.open} | ${r.resolved} |`,
    )
    .join("\n");

  // Fatos pré-calculados — só times com dados
  const nonEmpty = rows.filter((r) => r.total > 0);
  const factLines: string[] = [];

  if (nonEmpty.length > 0) {
    const minTotal = [...nonEmpty].sort((a, b) => a.total - b.total)[0];
    const maxTotal = [...nonEmpty].sort((a, b) => b.total - a.total)[0];
    const maxCritical = [...nonEmpty].sort(
      (a, b) => b.critical - a.critical,
    )[0];
    const minCritical = [...nonEmpty].sort(
      (a, b) => a.critical - b.critical,
    )[0];
    const maxHigh = [...nonEmpty].sort((a, b) => b.high - a.high)[0];
    const maxOpen = [...nonEmpty].sort((a, b) => b.open - a.open)[0];
    const maxResolved = [...nonEmpty].sort(
      (a, b) => b.resolved - a.resolved,
    )[0];
    const minResolved = [...nonEmpty].sort(
      (a, b) => a.resolved - b.resolved,
    )[0];

    const minRatio = [...nonEmpty].sort(
      (a, b) => a.resolved / a.total - b.resolved / b.total,
    )[0];
    const minRatioPct = ((minRatio.resolved / minRatio.total) * 100).toFixed(1);

    factLines.push(
      `- Time com **menos ocorrências** (total): **${minTotal.name}** — ${minTotal.total} observations`,
    );
    factLines.push(
      `- Time com **mais ocorrências** (total): **${maxTotal.name}** — ${maxTotal.total} observations`,
    );
    factLines.push(
      `- Time com **mais críticas**: **${maxCritical.name}** — ${maxCritical.critical} críticas`,
    );
    factLines.push(
      `- Time com **menos críticas** (entre times com dados): **${minCritical.name}** — ${minCritical.critical} críticas`,
    );
    factLines.push(
      `- Time com **mais altas**: **${maxHigh.name}** — ${maxHigh.high} altas`,
    );
    factLines.push(
      `- Time com **mais abertas**: **${maxOpen.name}** — ${maxOpen.open} abertas`,
    );
    factLines.push(
      `- Time que **resolveu mais**: **${maxResolved.name}** — ${maxResolved.resolved} resolvidas`,
    );
    factLines.push(
      `- Time que **resolveu menos** (entre times com dados): **${minResolved.name}** — ${minResolved.resolved} resolvidas`,
    );
    factLines.push(
      `- Time com **menor taxa de resolução**: **${minRatio.name}** — ${minRatio.resolved}/${minRatio.total} (${minRatioPct}%)`,
    );
  }

  const factBlock = factLines.length
    ? [
        ``,
        `## Fatos pré-calculados`,
        `_(use estes fatos literalmente em análises; não recalcule)_`,
        ``,
        ...factLines,
      ]
    : [];

  const out = [
    `# Comparativo entre times`,
    ``,
    `| Time | Total | Críticas | Altas | Abertas | Resolvidas |`,
    `|---|---:|---:|---:|---:|---:|`,
    tableRows || "| _(sem times)_ | 0 | 0 | 0 | 0 | 0 |",
    ...factBlock,
    SNAPSHOT_END,
  ].join("\n");

  setCached("__all-teams__", out);
  return out;
}

interface TeamMetric {
  name: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved: number;
  categories: { category: string; count: number; patterns: number }[];
}

async function computeTeamMetric(
  teamName: string,
  categoryLimit: number,
): Promise<TeamMetric | null> {
  const { mongo } = await resolveFilter({ teamName }, false);
  if (!mongo.project) return null;

  const [total, sev, st, categories] = await Promise.all([
    Observation.countDocuments(mongo),
    countBySeverity(mongo),
    countByStatus(mongo),
    topCategories(mongo, categoryLimit),
  ]);

  return {
    name: teamName,
    total,
    critical: sev.critical,
    high: sev.high,
    medium: sev.medium,
    low: sev.low,
    open: st.open,
    resolved: st.resolved,
    categories,
  };
}

async function getMultiTeamComparison(
  teamNames: string[],
  categoryLimit = 5,
): Promise<string> {
  const key = `multi-compare:${teamNames.join("|")}:${categoryLimit}`;
  const cached = getCached(key);
  if (cached) return cached;

  const metrics = (
    await Promise.all(teamNames.map((n) => computeTeamMetric(n, categoryLimit)))
  ).filter((m): m is TeamMetric => m !== null);

  if (metrics.length === 0) return "";

  const overviewRows = metrics
    .map(
      (r) =>
        `| ${r.name} | ${r.total} | ${r.critical} | ${r.high} | ${r.medium} | ${r.low} | ${r.open} | ${r.resolved} |`,
    )
    .join("\n");

  const detailSections = metrics.map((r) => {
    const catRows = r.categories
      .map((c) => `| ${c.category} | ${c.count} | ${c.patterns} |`)
      .join("\n");
    return [
      `### ${r.name} — top ${r.categories.length} categorias`,
      ``,
      `| Categoria | Observations | Padrões distintos |`,
      `|---|---:|---:|`,
      catRows || "| _(sem dados)_ | 0 | 0 |",
      ``,
    ].join("\n");
  });

  const nonEmpty = metrics.filter((r) => r.total > 0);
  const factLines: string[] = [];

  if (nonEmpty.length >= 2) {
    const minTotal = [...nonEmpty].sort((a, b) => a.total - b.total)[0];
    const maxTotal = [...nonEmpty].sort((a, b) => b.total - a.total)[0];
    const maxResolved = [...nonEmpty].sort(
      (a, b) => b.resolved - a.resolved,
    )[0];
    const minResolved = [...nonEmpty].sort(
      (a, b) => a.resolved - b.resolved,
    )[0];
    const maxCritical = [...nonEmpty].sort(
      (a, b) => b.critical - a.critical,
    )[0];

    factLines.push(
      `- Time com **menos ocorrências** (total): **${minTotal.name}** — ${minTotal.total} observations`,
    );
    factLines.push(
      `- Time com **mais ocorrências** (total): **${maxTotal.name}** — ${maxTotal.total} observations`,
    );
    factLines.push(
      `- Time que **resolveu mais**: **${maxResolved.name}** — ${maxResolved.resolved} resolvidas`,
    );
    factLines.push(
      `- Time que **resolveu menos**: **${minResolved.name}** — ${minResolved.resolved} resolvidas`,
    );
    factLines.push(
      `- Time com **mais críticas**: **${maxCritical.name}** — ${maxCritical.critical} críticas`,
    );
  }

  const factBlock = factLines.length
    ? [
        ``,
        `## Fatos pré-calculados`,
        `_(use estes fatos literalmente em análises; não recalcule)_`,
        ``,
        ...factLines,
      ]
    : [];

  const out = [
    `# Comparativo — ${teamNames.join(" vs ")}`,
    ``,
    `## Visão geral`,
    ``,
    `| Time | Total | Críticas | Altas | Médias | Baixas | Abertas | Resolvidas |`,
    `|---|---:|---:|---:|---:|---:|---:|---:|`,
    overviewRows,
    ``,
    `## Top ${categoryLimit} categorias por time`,
    ``,
    detailSections.join("\n"),
    ...factBlock,
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

async function getGlobalSnapshot(): Promise<string> {
  const cached = getCached("__global__");
  if (cached) return cached;

  const [total, sev, st, grouped] = await Promise.all([
    Observation.countDocuments({}),
    countBySeverity({}),
    countByStatus({}),
    topCategories({}, 8),
  ]);

  const pct = (n: number) =>
    total > 0 ? ` (${((n / total) * 100).toFixed(1)}%)` : "";
  const groupedRows = grouped
    .map((c) => `| ${c.category} | ${c.count} |`)
    .join("\n");

  const out = [
    `# Snapshot global`,
    ``,
    `| Métrica | Valor |`,
    `|---|---:|`,
    `| Total de observations | ${total} |`,
    `| Críticas | ${sev.critical}${pct(sev.critical)} |`,
    `| Altas | ${sev.high}${pct(sev.high)} |`,
    `| Médias | ${sev.medium}${pct(sev.medium)} |`,
    `| Baixas | ${sev.low}${pct(sev.low)} |`,
    `| Abertas | ${st.open} |`,
    `| Corrigidas | ${st.resolved} |`,
    ``,
    `## Top categorias`,
    ``,
    `| Categoria | Observations |`,
    `|---|---:|`,
    groupedRows || "| _(sem dados)_ | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached("__global__", out);
  return out;
}

async function getTopCategoriesSnapshot(
  n: number,
  filter: Filter,
): Promise<string> {
  const key = `top-cat:${n}:${JSON.stringify(filter)}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo, label } = await resolveFilter(filter);
  const [rows, total] = await Promise.all([
    topCategories(mongo, n),
    Observation.countDocuments(mongo),
  ]);

  const tableRows = rows
    .map((r) => `| ${r.category} | ${r.count} |`)
    .join("\n");

  const out = [
    `# Top ${n} categorias${label}`,
    ``,
    `| Categoria | Observations |`,
    `|---|---:|`,
    tableRows || "| _(sem dados)_ | 0 |",
    ``,
    `Total no filtro: **${total}**`,
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

async function getTopPatternsSnapshot(
  n: number,
  filter: Filter,
): Promise<string> {
  const key = `top-pat:${n}:${JSON.stringify(filter)}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo, label } = await resolveFilter(filter);
  const rows = await topPatterns(mongo, n);

  const tableRows = rows
    .map((r) => `| ${r.pattern} | ${r.category} | ${r.count} |`)
    .join("\n");

  const out = [
    `# Top ${n} padrões de detecção${label}`,
    ``,
    `| Padrão | Categoria | Observations |`,
    `|---|---|---:|`,
    tableRows || "| _(sem dados)_ | — | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

async function getTopProjectsSnapshot(
  n: number,
  filter: Filter,
): Promise<string> {
  const key = `top-proj:${n}:${JSON.stringify(filter)}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo, label } = await resolveFilter(filter);
  const rows = await topProjects(mongo, n);

  const tableRows = rows
    .map(
      (r) =>
        `| ${r.project} | ${r.total} | ${r.critical} | ${r.high} | ${r.medium} | ${r.low} |`,
    )
    .join("\n");

  const out = [
    `# Top ${n} projetos por observations${label}`,
    ``,
    `| Projeto | Total | Críticas | Altas | Médias | Baixas |`,
    `|---|---:|---:|---:|---:|---:|`,
    tableRows || "| _(sem dados)_ | 0 | 0 | 0 | 0 | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

async function getTopRepositoriesSnapshot(
  n: number,
  filter: Filter,
): Promise<string> {
  const key = `top-repo:${n}:${JSON.stringify(filter)}`;
  const cached = getCached(key);
  if (cached) return cached;

  const { mongo, label } = await resolveFilter(filter);
  const rows = await topRepositories(mongo, n);

  const tableRows = rows
    .map((r) => `| ${r.repository} | ${r.count} |`)
    .join("\n");

  const out = [
    `# Top ${n} repositórios${label}`,
    ``,
    `| Repositório | Observations |`,
    `|---|---:|`,
    tableRows || "| _(sem dados)_ | 0 |",
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

// ============================================================
// Endpoints da API
// ============================================================
function isUsableSummary(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (trimmed.length < 6) return false;
  if (/^=+$/.test(trimmed)) return false;
  if (
    /^(content|description|type|properties|required|summary)\s*:/i.test(trimmed)
  )
    return false;
  if (/^\d{3}\s*:/.test(trimmed)) return false;
  return true;
}

function pickSummary(meta: Record<string, unknown>): string {
  const summary = String(meta.summary ?? "").trim();
  if (isUsableSummary(summary)) return summary;
  const method = String(meta.method ?? "").trim();
  const path = String(meta.path ?? "").trim();
  return `${method} ${path}`;
}

async function getApiEndpointsSnapshot(filter?: {
  method?: string;
  tag?: string;
}): Promise<string> {
  const key = `api-endpoints:${JSON.stringify(filter ?? {})}`;
  const cached = getCached(key);
  if (cached) return cached;

  const query: Record<string, unknown> = { source: "openapi" };
  if (filter?.method) query["metadata.method"] = filter.method.toUpperCase();
  if (filter?.tag) query["metadata.tags"] = filter.tag;

  const docs = await AiEmbedding.find(query).lean();

  docs.sort((a, b) => {
    const am = (a.metadata ?? {}) as Record<string, unknown>;
    const bm = (b.metadata ?? {}) as Record<string, unknown>;
    const ap = String(am.path ?? "");
    const bp = String(bm.path ?? "");
    if (ap !== bp) return ap.localeCompare(bp);
    return String(am.method ?? "").localeCompare(String(bm.method ?? ""));
  });

  const rows = docs
    .map((d) => {
      const meta = (d.metadata ?? {}) as Record<string, unknown>;
      const method = String(meta.method ?? "");
      const path = String(meta.path ?? "");
      const summary = pickSummary(meta);
      return `| \`${method}\` | \`${path}\` | ${summary} |`;
    })
    .join("\n");

  const filterLabel: string[] = [];
  if (filter?.method)
    filterLabel.push(`método \`${filter.method.toUpperCase()}\``);
  if (filter?.tag) filterLabel.push(`tag \`${filter.tag}\``);
  const label = filterLabel.length ? ` (${filterLabel.join(", ")})` : "";

  const out = [
    `# Endpoints da API${label}`,
    ``,
    `| Método | Rota | Resumo |`,
    `|---|---|---|`,
    rows || "| _(sem endpoints)_ | — | — |",
    ``,
    `Total: **${docs.length}** endpoint(s).`,
    ``,
    `Para detalhes de um endpoint específico, pergunte sobre a rota (ex: "como funciona o POST /api/wiki/create?").`,
    SNAPSHOT_END,
  ].join("\n");

  setCached(key, out);
  return out;
}

// ============================================================
// Detecção de entidades
// ============================================================
async function detectTeams(tokens: string[]): Promise<string[]> {
  const teams = await Team.find(
    { isGlobal: { $ne: true } },
    { name: 1 },
  ).lean();

  const tokenSet = new Set(tokens);
  const exactMatches: string[] = [];

  // 1) Match exato (todos os tokens do nome presentes na query)
  for (const t of teams) {
    if (!t.name) continue;
    const teamTokens = tokenize(t.name);
    if (teamTokens.length === 0) continue;
    if (teamTokens.every((tt) => tokenSet.has(tt))) {
      exactMatches.push(t.name);
    }
  }

  if (exactMatches.length > 0) return exactMatches;

  // 2) Fallback fuzzy — só escolhe o time com MENOR distância
  //    (evita GDSAF ≈ GDSAT quando ambos existem)
  const found: string[] = [];
  for (const q of tokens) {
    if (q.length < 3) continue;
    let best: { name: string; distance: number } | null = null;

    for (const t of teams) {
      if (!t.name) continue;
      const nameNorm = tokenize(t.name).join("");
      if (nameNorm.length < 3) continue;

      const maxLen = Math.max(q.length, nameNorm.length);
      const tol = maxLen <= 6 ? 1 : maxLen <= 10 ? 2 : 3;
      const d = lev(q, nameNorm);
      if (d <= tol && (!best || d < best.distance)) {
        best = { name: t.name, distance: d };
      }
    }

    if (best && !found.includes(best.name)) found.push(best.name);
  }

  return found;
}

async function detectProject(tokens: string[]): Promise<string | null> {
  const projects = await Project.find({}, { name: 1 }).lean();
  for (const p of projects) {
    if (!p.name) continue;
    if (containsPhrase(tokens, p.name)) return p.name;
  }
  return null;
}

// ============================================================
// Builder principal
// ============================================================
export interface LiveContextResult {
  context: string;
  sections: string[];
}

function finalize(sections: string[]): LiveContextResult {
  return {
    context: sections
      .filter(Boolean)
      .map((s) => wrapSnapshot(s))
      .join("\n\n---\n\n"),
    sections: sections.map((s) =>
      s
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .trim(),
    ),
  };
}

export async function buildLiveContext(
  query: string,
): Promise<LiveContextResult> {
  await connectToDatabase();

  const tokens = tokenize(query);
  const norm = tokens.join(" ");
  const sections: string[] = [];

  const matchedTeams = await detectTeams(tokens);
  const teamName = matchedTeams[0];
  const multiTeams = matchedTeams;

  // Multi-team só dispara comparação se a intenção da query for
  // comparativa OU se houver de fato 2+ times reais mencionados.
  const isComparisonIntent = /compar|compara|vs|entre|ranking/i.test(query);
  if (multiTeams.length >= 2 && isComparisonIntent) {
    sections.push(await getMultiTeamComparison(multiTeams));
    return finalize(sections);
  }

  // Se só 1 time foi mencionado (ou vários sem intenção comparativa),
  // prioriza o resumo executivo do primeiro.
  // Se for follow-up ("e o GDSAF?"), o rag/route já reconstruiu a
  // effectiveQuery com o contexto anterior — então teamName pega o
  // time novo, e a intenção `exec` é inferida abaixo.

  let intent = classify(tokens);

  if (!intent && teamName) {
    if (tokens.some((t) => closeEnough(t, "resumo"))) intent = "exec";
    else if (
      tokens.some(
        (t) =>
          closeEnough(t, "dashboard") ||
          closeEnough(t, "overview") ||
          closeEnough(t, "panorama"),
      )
    )
      intent = "exec";
  }

  // Fallback: query curta + 1 time → resumo executivo do time
  if (!intent && teamName && tokens.length <= 8) {
    intent = "exec";
  }

  const statusFilter = extractStatusFilter(tokens);
  const severityFilter = extractSeverityFilter(tokens);

  switch (intent) {
    case "api_endpoints": {
      const method = extractHttpMethod(tokens);
      const tag = await extractApiTag(tokens);
      sections.push(await getApiEndpointsSnapshot({ method, tag }));
      return finalize(sections);
    }

    case "all_teams": {
      // Se algum time específico foi mencionado junto com "compare",
      // compara só esses; caso contrário, todos.
      if (multiTeams.length >= 2) {
        sections.push(await getMultiTeamComparison(multiTeams));
      } else {
        sections.push(await getAllTeamsComparison());
      }
      return finalize(sections);
    }

    case "stats": {
      const days = extractTimeRange(norm);
      if (teamName) {
        const snap = await getTeamStats(teamName, days);
        if (snap) sections.push(snap);
        else sections.push(await getGlobalSnapshot());
      } else {
        sections.push(await getGlobalSnapshot());
      }
      return finalize(sections);
    }

    case "exec": {
      if (teamName) {
        const snap = await getTeamExecutive(teamName);
        if (snap) sections.push(snap);
        else sections.push(await getGlobalSnapshot());
      } else {
        sections.push(await getGlobalSnapshot());
      }
      return finalize(sections);
    }

    case "top_patterns": {
      const n = extractTopN(tokens, 8);
      const projectName = await detectProject(tokens);
      const filter: Filter = {
        teamName,
        projectNames: projectName ? [projectName] : undefined,
        status: statusFilter,
        severity: severityFilter,
      };
      sections.push(await getTopPatternsSnapshot(n, filter));
      return finalize(sections);
    }

    case "top_categories": {
      const n = extractTopN(tokens, 8);
      const projectName = await detectProject(tokens);
      const filter: Filter = {
        teamName,
        projectNames: projectName ? [projectName] : undefined,
        status: statusFilter,
        severity: severityFilter,
      };
      sections.push(await getTopCategoriesSnapshot(n, filter));
      return finalize(sections);
    }

    case "top_projects": {
      const n = extractTopN(tokens, 10);
      const filter: Filter = {
        teamName,
        status: statusFilter,
        severity: severityFilter,
      };
      sections.push(await getTopProjectsSnapshot(n, filter));
      return finalize(sections);
    }

    case "top_repos": {
      const n = extractTopN(tokens, 8);
      const filter: Filter = {
        teamName,
        status: statusFilter,
        severity: severityFilter,
      };
      sections.push(await getTopRepositoriesSnapshot(n, filter));
      return finalize(sections);
    }

    case "data_intent": {
      if (teamName) {
        const snap = await getTeamExecutive(teamName);
        if (snap) sections.push(snap);
        else sections.push(await getGlobalSnapshot());
      } else {
        const projectName = await detectProject(tokens);
        if (projectName) {
          sections.push(
            await getTopProjectsSnapshot(5, {
              projectNames: [projectName],
            }),
          );
        } else {
          sections.push(await getGlobalSnapshot());
        }
      }
      return finalize(sections);
    }
  }

  if (teamName) {
    sections.push(await getTeamExecutive(teamName));
    return finalize(sections);
  }

  const projectName = await detectProject(tokens);
  if (projectName) {
    sections.push(
      await getTopProjectsSnapshot(5, { projectNames: [projectName] }),
    );
    return finalize(sections);
  }

  return finalize(sections);
}
