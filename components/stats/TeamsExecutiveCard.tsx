// components/stats/TeamsExecutiveCard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FolderTree,
  Fingerprint,
  Boxes,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Users,
  Sparkles,
  FileDown,
  BarChart3,
} from "lucide-react";
import { FaFilePdf } from "react-icons/fa";
import { useRangeState } from "@/hooks/useRangeState";
import { writeRangeState } from "@/lib/range-options";
import { exportTeamsExecutivePDF } from "@/utils/exportTeamsExecutivePDF";
import type {
  TeamCategoryRow,
  TeamExecutiveEntry,
  TeamPatternRow,
  TeamProjectRow,
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
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
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
        <h4 className="flex-1 text-sm font-semibold text-heading">{title}</h4>
        {typeof count === "number" && (
          <span className="text-[10px] font-medium text-muted bg-sunken px-2 py-0.5 rounded-full">
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
// Tabela comparativa entre times
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
          {teams.map((t, idx) => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Categorias
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
            <th className="py-2 px-3 font-medium text-right">
              Padrões distintos
            </th>
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

// ============================================================
// Padrões
// ============================================================
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
// Projetos
// ============================================================
function ProjectTable({
  rows,
  showTeamColumn,
}: {
  rows: TeamProjectRow[];
  showTeamColumn: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted py-4 text-center">
        Nenhum projeto encontrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-default/50">
            <th className="py-2 px-3 font-medium">Projeto</th>
            {showTeamColumn && <th className="py-2 px-3 font-medium">Time</th>}
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
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={`${p.teamName}-${p.project}`}
              className="border-b border-default/30 last:border-0 hover:bg-sunken/30 transition-colors"
            >
              <td className="py-2 px-3 text-heading font-mono text-[11px] truncate max-w-[240px]">
                {p.project}
              </td>
              {showTeamColumn && (
                <td className="py-2 px-3 text-muted font-mono text-[10px]">
                  {p.teamName}
                </td>
              )}
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
          {/* --------- Consolidado (colapsável, aberto por padrão) --------- */}
          <CollapsibleSection
            title="Consolidado"
            icon={<BarChart3 className="w-4 h-4" />}
            count={visibleTeams.length}
            defaultOpen
          >
            <ComparativeTable teams={visibleTeams} />
          </CollapsibleSection>

          {/* --------- Demais seções --------- */}
          <CollapsibleSection
            title="Distribuição por Categoria"
            icon={<FolderTree className="w-4 h-4" />}
            count={data?.aggregated.categories.length}
          >
            <CategoryTable rows={data?.aggregated.categories ?? []} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Distribuição por Padrão de Detecção"
            icon={<Fingerprint className="w-4 h-4" />}
            count={data?.aggregated.patterns.length}
          >
            <PatternTable rows={data?.aggregated.patterns ?? []} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Projetos Vinculados"
            icon={<Boxes className="w-4 h-4" />}
            count={data?.aggregated.projects.length}
          >
            <ProjectTable
              rows={data?.aggregated.projects ?? []}
              showTeamColumn={isGlobal}
            />
          </CollapsibleSection>
        </>
      )}
    </section>
  );
}
