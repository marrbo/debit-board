// components/stats/TeamsExecutiveCard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  FolderTree,
  Fingerprint,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Users,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { FaFilePdf } from "react-icons/fa";
import { useRangeState } from "@/hooks/useRangeState";
import { writeRangeState } from "@/lib/range-options";
import { exportTeamsExecutivePDF } from "@/utils/exportTeamsExecutivePDF";
import ScoreGauge from "@/components/ScoreGauge";
import { BAND_META } from "@/lib/risk";
import type {
  CurrentStateProjectRow,
  RiskAggregate,
  TeamCategoryRow,
  TeamCurrentState,
  TeamExecutiveEntry,
  TeamPatternRow,
  TeamsExecutiveResponse,
} from "@/types/ITeamsExecutive";

// ============================================================
// Helpers
// ============================================================
const pct = (n: number, total: number): string =>
  total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "0%";

// ============================================================
// Seção colapsável
// ============================================================
function CollapsibleSection({
  title,
  subtitle,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-default dark:border-strong">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-sunken/40"
      >
        <ChevronRight
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-brand shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-heading truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[10px] text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {typeof count === "number" && (
          <span className="text-[10px] font-medium text-muted bg-sunken px-2 py-0.5 rounded-full shrink-0">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Barra empilhada genérica
// ============================================================
interface StackedSegment {
  label: string;
  value: number;
  color: string;
}

function StackedBar({
  segments,
  height = "h-2",
}: {
  segments: StackedSegment[];
  height?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div
        className={`w-full ${height} rounded-full bg-default/30 dark:bg-sunken`}
      />
    );
  }
  return (
    <div
      className={`w-full ${height} rounded-full overflow-hidden bg-default/20 dark:bg-sunken flex`}
    >
      {segments.map((seg) => (
        <div
          key={seg.label}
          title={`${seg.label}: ${seg.value}`}
          style={{ flexGrow: seg.value, backgroundColor: seg.color }}
        />
      ))}
    </div>
  );
}

function SegmentLegend({ segments }: { segments: StackedSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {segments.map((seg) => (
        <span
          key={seg.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: seg.color }}
          />
          {seg.label}
          <span className="text-heading font-semibold tabular-nums">
            {seg.value}
          </span>
          <span className="text-muted/70 tabular-nums text-[10px]">
            ({pct(seg.value, total)})
          </span>
        </span>
      ))}
    </div>
  );
}

const SLA_COLORS = {
  overdue: "#dc2626",
  atRisk: "#f97316",
  onTrack: "#16a34a",
};

const AGING_COLORS = {
  days0To30: "#16a34a",
  days31To60: "#eab308",
  days61To90: "#f97316",
  days90Plus: "#dc2626",
};

// ============================================================
// Risco Atual — hero + KPIs + SLA + Aging + Top projetos
// ============================================================
interface CurrentStatePanelProps {
  state: TeamCurrentState;
  showTeamColumn: boolean;
}

function CurrentStatePanel({ state, showTeamColumn }: CurrentStatePanelProps) {
  const { risk, totals, aging, projects } = state;

  if (totals.total === 0) {
    return (
      <div className="text-center text-xs text-muted py-6">
        Nenhum item aberto ou recorrente para os filtros atuais.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* --------- Hero: gauge + banda + mensagem --------- */}
      <RiskHero risk={risk} />

      {/* --------- KPIs --------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <KpiTile label="Exposto" value={totals.total} accent="brand" />
        <KpiTile label="Crítico" value={totals.critical} accent="critical" />
        <KpiTile label="Alto" value={totals.high} accent="high" />
        <KpiTile label="Médio" value={totals.medium} accent="medium" />
        <KpiTile label="Baixo" value={totals.low} accent="low" />
      </div>

      {/* --------- SLA + Aging em grid --------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-default/50 dark:border-strong/40 p-3 bg-sunken/20 dark:bg-sunken/40">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              SLA
            </h5>
            {totals.overdue > 0 && (
              <span className="text-[10px] text-red-500 font-semibold">
                {pct(totals.overdue, totals.total)} vencido
              </span>
            )}
          </div>
          <StackedBar
            segments={[
              {
                label: "Em dia",
                value: totals.onTrack,
                color: SLA_COLORS.onTrack,
              },
              {
                label: "Em risco",
                value: totals.atRisk,
                color: SLA_COLORS.atRisk,
              },
              {
                label: "Vencido",
                value: totals.overdue,
                color: SLA_COLORS.overdue,
              },
            ].filter((s) => s.value > 0)}
          />
          <div className="mt-2.5">
            <SegmentLegend
              segments={[
                {
                  label: "Em dia",
                  value: totals.onTrack,
                  color: SLA_COLORS.onTrack,
                },
                {
                  label: "Em risco",
                  value: totals.atRisk,
                  color: SLA_COLORS.atRisk,
                },
                {
                  label: "Vencido",
                  value: totals.overdue,
                  color: SLA_COLORS.overdue,
                },
              ].filter((s) => s.value > 0 || s.label === "Vencido")}
            />
          </div>
        </div>

        <div className="rounded-lg border border-default/50 dark:border-strong/40 p-3 bg-sunken/20 dark:bg-sunken/40">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Tempo em aberto
            </h5>
            {aging.days90Plus > 0 && (
              <span className="text-[10px] text-red-500 font-semibold">
                {aging.days90Plus} acima de 90d
              </span>
            )}
          </div>
          <StackedBar
            segments={[
              {
                label: "0–30d",
                value: aging.days0To30,
                color: AGING_COLORS.days0To30,
              },
              {
                label: "31–60d",
                value: aging.days31To60,
                color: AGING_COLORS.days31To60,
              },
              {
                label: "61–90d",
                value: aging.days61To90,
                color: AGING_COLORS.days61To90,
              },
              {
                label: "90d+",
                value: aging.days90Plus,
                color: AGING_COLORS.days90Plus,
              },
            ].filter((s) => s.value > 0)}
          />
          <div className="mt-2.5">
            <SegmentLegend
              segments={[
                {
                  label: "0–30d",
                  value: aging.days0To30,
                  color: AGING_COLORS.days0To30,
                },
                {
                  label: "31–60d",
                  value: aging.days31To60,
                  color: AGING_COLORS.days31To60,
                },
                {
                  label: "61–90d",
                  value: aging.days61To90,
                  color: AGING_COLORS.days61To90,
                },
                {
                  label: "90d+",
                  value: aging.days90Plus,
                  color: AGING_COLORS.days90Plus,
                },
              ].filter((s) => s.value > 0)}
            />
          </div>
        </div>
      </div>

      {/* --------- Top projetos por risco --------- */}
      {projects.length > 0 && (
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
            Projetos por exposição
          </h5>
          <ExposedProjectsTable
            rows={projects}
            showTeamColumn={showTeamColumn}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Risk hero
// ============================================================
function RiskHero({ risk }: { risk: RiskAggregate }) {
  const meta = BAND_META[risk.band];
  return (
    <div
      className={`rounded-lg border p-4 flex items-center gap-5 ${meta.bg} ${meta.border}`}
    >
      <div className="shrink-0">
        <ScoreGauge score={risk.score} size={104} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          Risco atual
        </div>
        <div className={`text-xl font-bold ${meta.text} leading-tight`}>
          {meta.label}
        </div>
        <p className="text-xs text-body mt-1 leading-snug">{meta.executive}</p>
        <p className="text-[11px] text-muted mt-1 leading-snug">
          {meta.specialist}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// KPI tile
// ============================================================
type KpiAccent = "brand" | "critical" | "high" | "medium" | "low";

const ACCENT_CLASS: Record<KpiAccent, string> = {
  brand: "text-heading",
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function KpiTile({
  label,
  value,
  accent = "brand",
}: {
  label: string;
  value: number;
  accent?: KpiAccent;
}) {
  return (
    <div className="rounded-lg border border-default/50 dark:border-strong/40 bg-sunken/20 dark:bg-sunken/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted truncate">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums mt-0.5 ${ACCENT_CLASS[accent]}`}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Projetos por exposição (com risco)
// ============================================================
function ExposedProjectsTable({
  rows,
  showTeamColumn,
}: {
  rows: CurrentStateProjectRow[];
  showTeamColumn: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-default/50">
            <th className="py-2 px-3 font-medium">Projeto</th>
            {showTeamColumn && <th className="py-2 px-3 font-medium">Time</th>}
            <th className="py-2 px-3 font-medium text-right">Risco</th>
            <th className="py-2 px-3 font-medium text-right">Total</th>
            <th className="py-2 px-3 font-medium text-right text-red-500">
              Crítico
            </th>
            <th className="py-2 px-3 font-medium text-right text-orange-500">
              Alto
            </th>
            <th className="py-2 px-3 font-medium text-right text-amber-500">
              Médio
            </th>
            <th className="py-2 px-3 font-medium text-right text-emerald-500">
              Baixo
            </th>
            <th className="py-2 px-3 font-medium text-right text-red-500">
              SLA vencido
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const meta = BAND_META[p.risk.band];
            return (
              <tr
                key={`${p.teamName}-${p.project}`}
                className="border-b border-default/30 last:border-0 hover:bg-sunken/30 transition-colors"
              >
                <td className="py-2 px-3 text-heading font-mono text-[11px] truncate max-w-[200px]">
                  {p.project}
                </td>
                {showTeamColumn && (
                  <td className="py-2 px-3 text-muted font-mono text-[10px]">
                    {p.teamName}
                  </td>
                )}
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${meta.text}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: meta.hex }}
                    />
                    {p.risk.score}
                  </span>
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-bold">
                  {p.total}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-red-500 font-semibold">
                  {p.critical || ""}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-orange-500 font-semibold">
                  {p.high || ""}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-amber-500">
                  {p.medium || ""}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-500">
                  {p.low || ""}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {p.overdue > 0 ? (
                    <span className="text-red-500">{p.overdue}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Comparativo entre times (fluxo)
// ============================================================
function ComparativeTable({ teams }: { teams: TeamExecutiveEntry[] }) {
  if (teams.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-muted text-sm">
        Nenhum dado encontrado para os filtros atuais.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-default dark:border-strong">
            <th className="py-2.5 px-3 font-medium">Time</th>
            <th className="py-2.5 px-3 font-medium text-right">Risco atual</th>
            <th className="py-2.5 px-3 font-medium text-right">Total</th>
            <th className="py-2.5 px-3 font-medium text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Crítico
              </span>
            </th>
            <th className="py-2.5 px-3 font-medium text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Alto
              </span>
            </th>
            <th className="py-2.5 px-3 font-medium text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Médio
              </span>
            </th>
            <th className="py-2.5 px-3 font-medium text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Baixo
              </span>
            </th>
            <th className="py-2.5 px-3 font-medium text-right">Abertas</th>
            <th className="py-2.5 px-3 font-medium text-right">Corrigidas</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, idx) => {
            const meta = BAND_META[t.currentState.risk.band];
            return (
              <tr
                key={t.teamId}
                className={`border-b border-default/50 dark:border-strong/50 last:border-0 transition-colors hover:bg-sunken/40 ${
                  idx === 0 ? "font-medium" : ""
                }`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    {idx === 0 && teams.length > 1 && (
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    )}
                    <span className="text-heading truncate font-mono text-[11px]">
                      {t.teamName}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${meta.text}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: meta.hex }}
                    />
                    {t.currentState.risk.score}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-heading tabular-nums">
                  {t.totals.total}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <span className="text-red-500 font-semibold">
                    {t.totals.critical}
                  </span>
                  <span className="text-muted text-[10px] ml-1">
                    {pct(t.totals.critical, t.totals.total)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <span className="text-orange-500 font-semibold">
                    {t.totals.high}
                  </span>
                  <span className="text-muted text-[10px] ml-1">
                    {pct(t.totals.high, t.totals.total)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <span className="text-amber-500 font-semibold">
                    {t.totals.medium}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <span className="text-emerald-500 font-semibold">
                    {t.totals.low}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-heading">
                  {t.totals.open}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-heading">
                  {t.totals.resolved}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Categorias / Padrões
// ============================================================
function CategoryTable({ rows }: { rows: TeamCategoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        Nenhuma categoria encontrada.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-default/50">
            <th className="py-2 px-3 font-medium">Categoria</th>
            <th className="py-2 px-3 font-medium text-right">Observations</th>
            <th className="py-2 px-3 font-medium text-right">Padrões</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.category}
              className="border-b border-default/30 last:border-0 hover:bg-sunken/30 transition-colors"
            >
              <td className="py-2 px-3 text-heading">{c.category}</td>
              <td className="py-2 px-3 text-right tabular-nums font-mono text-[11px]">
                {c.observations}
              </td>
              <td className="py-2 px-3 text-right tabular-nums font-mono text-[11px] text-muted">
                {c.patterns}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatternTable({ rows }: { rows: TeamPatternRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        Nenhum padrão encontrado.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-default/50">
            <th className="py-2 px-3 font-medium">Padrão</th>
            <th className="py-2 px-3 font-medium">Categoria</th>
            <th className="py-2 px-3 font-medium text-right">Observations</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.patternId}
              className="border-b border-default/30 last:border-0 hover:bg-sunken/30 transition-colors"
            >
              <td className="py-2 px-3 text-heading">{p.patternName}</td>
              <td className="py-2 px-3 text-muted text-[11px]">{p.category}</td>
              <td className="py-2 px-3 text-right tabular-nums font-mono text-[11px]">
                {p.observations}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Card principal
// ============================================================
interface TeamsExecutiveCardProps {
  teamId: string | null;
  searchQuery: string;
}

export default function TeamsExecutiveCard({
  teamId,
  searchQuery,
}: TeamsExecutiveCardProps) {
  const { state: rangeState, rangeKey } = useRangeState();
  const [data, setData] = useState<TeamsExecutiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (teamId && teamId !== "all") params.set("teamId", teamId);
      if (searchQuery) params.set("q", searchQuery);
      writeRangeState(rangeState, params);

      const res = await fetch(
        `/api/stats/teams-executive?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Erro ao carregar relatório executivo");
      const json = (await res.json()) as TeamsExecutiveResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, searchQuery, rangeKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isGlobal = !teamId || teamId === "all";
  const visibleTeams = useMemo(() => data?.teams ?? [], [data]);

  const teamLabel = useMemo(() => {
    if (isGlobal) return "Global";
    return visibleTeams[0]?.teamName ?? "Time";
  }, [isGlobal, visibleTeams]);

  const handleExportPDF = useCallback(async () => {
    if (!data || visibleTeams.length === 0) return;
    setExporting(true);
    try {
      exportTeamsExecutivePDF({ data, teamLabel });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Erro ao gerar PDF do relatório executivo.");
    } finally {
      setExporting(false);
    }
  }, [data, visibleTeams.length, teamLabel]);

  const hasData = !!data && visibleTeams.length > 0;
  const currentState = data?.aggregated.currentState;
  const hasCurrentState = (currentState?.totals.total ?? 0) > 0;

  return (
    <section className="bg-elevated h-full border border-default dark:border-none rounded-lg shadow-sm hover:drop-shadow-lg dark:shadow-none transition-colors overflow-hidden">
      {/* --------- Header --------- */}
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-default dark:border-strong">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-brand/10 shrink-0">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-heading dark:text-heading">
              Resumo Executivo
            </h3>
            <p className="text-[11px] text-muted truncate">
              {isGlobal
                ? "Comparativo de segurança entre times"
                : `Detalhes do time ${teamLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={!hasData || exporting}
            title="Exportar relatório executivo em PDF"
            className="flex items-center gap-1.5 px-2 aspect-square py-1 rounded-full border border-default dark:border-strong text-[11px] font-medium text-muted hover:text-red-500 hover:bg-red-300/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FaFilePdf className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted bg-sunken px-2 py-1 rounded-md">
            <Users className="w-3 h-3" />
            {isGlobal
              ? `${visibleTeams.length} ${
                  visibleTeams.length === 1 ? "time" : "times"
                }`
              : teamLabel}
          </span>
        </div>
      </header>

      {/* --------- Conteúdo --------- */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-brand" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 px-5 py-4 text-xs text-error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : !hasData ? (
        <div className="px-5 py-8 text-center text-sm text-muted">
          Nenhuma observação encontrada para os filtros atuais.
        </div>
      ) : (
        <>
          {/* 1. Risco Atual (state) */}
          {hasCurrentState && currentState && (
            <CollapsibleSection
              title="Risco Atual"
              subtitle="Abertas + recorrentes · ignora a janela temporal"
              icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
              count={currentState.totals.total}
              defaultOpen
            >
              <CurrentStatePanel
                state={currentState}
                showTeamColumn={isGlobal}
              />
            </CollapsibleSection>
          )}

          {/* 2. Fluxo no período (flow) */}
          <CollapsibleSection
            title="Fluxo no período"
            subtitle="Atividade dentro da janela temporal aplicada"
            icon={<BarChart3 className="w-4 h-4" />}
            count={visibleTeams.length}
          >
            <ComparativeTable teams={visibleTeams} />
          </CollapsibleSection>

          {/* 3. Categorias (flow) */}
          <CollapsibleSection
            title="Distribuição por Categoria"
            subtitle="Observations no período"
            icon={<FolderTree className="w-4 h-4" />}
            count={data?.aggregated.categories.length}
          >
            <CategoryTable rows={data?.aggregated.categories ?? []} />
          </CollapsibleSection>

          {/* 4. Padrões (flow) */}
          <CollapsibleSection
            title="Top Padrões de Detecção"
            subtitle="Observations no período"
            icon={<Fingerprint className="w-4 h-4" />}
            count={data?.aggregated.patterns.length}
          >
            <PatternTable rows={data?.aggregated.patterns ?? []} />
          </CollapsibleSection>
        </>
      )}
    </section>
  );
}
