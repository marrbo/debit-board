// components/dashboard/widget-renderer.tsx
"use client";

import TeamStatsCard from "@/components/TeamStatsCard";
import TeamsExecutiveCard from "@/components/stats/TeamsExecutiveCard";
import EvolutionWidget from "@/components/dashboard/EvolutionWidget";
import TopProjectsWidget from "@/components/dashboard/TopProjectsWidget";
import CategoryPieWidget from "@/components/dashboard/CategoryPieWidget";
import SASTTimelineWidget from "@/components/dashboard/SASTTimelineWidget";
import { DataTable } from "@/components/DataTable";
import { projectColumns } from "@/components/dashboard/projectColumns";
import type { StatsData, DashboardStatsResponse } from "@/types/IStats";
import type { RangeState } from "@/lib/range-options";

// ============================================================
// Dependências por widget
// ============================================================
/**
 * Widgets que consomem `/api/dashboard/stats` (team stats + project
 * stats + category details). Mantido aqui para que `page.tsx` e
 * `TVClient.tsx` sempre concordem sobre o que buscar.
 */
export const WIDGETS_NEEDING_DASHBOARD_STATS = [
  "severity-status",
  "category",
  "projects-table",
] as const;

/**
 * Widgets que consomem `/api/stats` (KPIs, chart data, project totals).
 */
export const WIDGETS_NEEDING_STATS = [
  "evolution",
  "category-pie",
  "top-projects",
] as const;

// ============================================================
// Contexto de render
// ============================================================
export type WidgetVariant = "dashboard" | "tv";

export interface WidgetRenderContext {
  stats: StatsData | null;
  dashboardStats: DashboardStatsResponse | null;
  /** Time efetivo. `"all"` = Global. */
  teamId: string;
  /** Nome do time exibido nos cabeçalhos de tabela. */
  teamName: string;
  searchDbqlId: string;
  rangeState: RangeState;
  /** Força refetch do grid de projetos. TV pode passar 0. */
  searchVersion?: number;
  /** Apenas em Dashboard. Abre o modal expandido. TV passa `undefined`. */
  onExpand?: (id: string) => void;
  /**
   * `"dashboard"` (default): alturas originais, export PDF ativo,
   * modal expandido. `"tv"`: alturas maiores para leitura à
   * distância, sem export.
   */
  variant?: WidgetVariant;
}

// ============================================================
// Renderizador único
// ============================================================
/**
 * Renderiza um widget do dashboard por `id`. Fonte única de verdade
 * para `app/page.tsx` e `app/tv/TVClient.tsx`.
 *
 * **Adicionar um novo widget** requer apenas:
 *   1. Registrá-lo em `DASHBOARD_WIDGETS` (`hooks/useDashboardLayout.ts`).
 *   2. Adicionar um `case` aqui.
 *   3. Se ele consumir endpoints, incluir seu id em uma das duas
 *      listas `WIDGETS_NEEDING_*` acima.
 *
 * Nenhum caller (Dashboard ou TV) precisa ser tocado.
 */
export function renderDashboardWidget(
  id: string,
  ctx: WidgetRenderContext,
): React.ReactNode {
  const {
    stats,
    dashboardStats,
    teamId,
    teamName,
    searchDbqlId,
    rangeState,
    searchVersion = 0,
    onExpand,
    variant = "dashboard",
  } = ctx;

  const isTv = variant === "tv";
  const teamLabel = teamId === "all" ? "Global" : teamName;
  const teamStats = dashboardStats?.teamStats;

  switch (id) {
    case "severity-status":
      // Fonte única: `dashboardStats.teamStats`. Antes o TV usava
      // `/api/stats` e o Dashboard `/api/dashboard/stats` — duas
      // fontes para o mesmo card, com risco de divergência silenciosa.
      return (
        <TeamStatsCard
          type="status"
          title="Severidade e Status"
          total={teamStats?.total ?? 0}
          severity={teamStats?.severityTotals ?? {}}
          status={teamStats?.statusTotals ?? {}}
        />
      );

    case "evolution":
      return (
        <EvolutionWidget
          chartData={stats?.chartData ?? []}
          onExpand={onExpand ? () => onExpand("evolution") : undefined}
          {...(isTv ? { height: 380 } : {})}
        />
      );

    case "sast-timeline":
      return (
        <SASTTimelineWidget
          limit={15}
          teamId={teamId === "all" ? null : teamId}
          dbqlId={searchDbqlId || null}
        />
      );

    case "executive":
      return <TeamsExecutiveCard teamId={teamId} searchQuery={searchDbqlId} />;

    case "category-pie":
      return (
        <CategoryPieWidget
          categories={stats?.categoryTotals ?? []}
          onExpand={onExpand ? () => onExpand("category-pie") : undefined}
          {...(isTv ? { height: 380 } : {})}
        />
      );

    case "category":
      // Fonte única: `dashboardStats.teamStats` — tem `categoryGroupTotals`
      // e `categoryDetails` (enriquecido com nomes de pattern).
      return (
        <TeamStatsCard
          type="category"
          title="Distribuição por Categoria"
          total={teamStats?.total ?? 0}
          category={teamStats?.categoryTotals ?? {}}
          categoryGroup={teamStats?.categoryGroupTotals ?? {}}
          categoryDetails={dashboardStats?.categoryDetails ?? {}}
        />
      );

    case "top-projects":
      return (
        <TopProjectsWidget
          projects={stats?.projectTotals ?? []}
          limit={isTv ? 10 : 8}
          {...(isTv ? { height: 380 } : {})}
          onExpand={onExpand ? () => onExpand("top-projects") : undefined}
        />
      );

    case "projects-table":
      return (
        <div className="w-full">
          <h3 className="text-lg font-semibold mb-4 text-heading">
            Projetos - {teamLabel}
          </h3>
          <DataTable
            endpoint="/api/dashboard"
            columns={projectColumns}
            defaultSort={{ field: "name", order: "asc" }}
            defaultLimit={isTv ? 8 : 5}
            searchDbqlId={searchDbqlId}
            refreshKey={searchVersion}
            range={
              rangeState.mode === "preset" && rangeState.preset !== "all"
                ? rangeState.preset
                : undefined
            }
            rangeFrom={
              rangeState.mode === "custom" ? rangeState.from : undefined
            }
            rangeTo={rangeState.mode === "custom" ? rangeState.to : undefined}
            pdfTitle={`Projetos: Severidades - ${teamLabel}`}
            teamId={teamId}
            extraData={dashboardStats?.projectStats ?? {}}
            exportPDF={!isTv}
            onRowClick={() => {}}
          />
        </div>
      );

    default:
      return null;
  }
}
