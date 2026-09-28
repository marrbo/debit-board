// components/dashboard/TopProjectsWidget.tsx
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Maximize2 } from "lucide-react";
import Charts from "@/components/Charts";
import SlideToggle from "@/components/SlideToggle";
import { useSlideToggle } from "@/hooks/useLocalSettings";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/lib/palette";
import type { StatsProject } from "@/types/IStats";

interface TopProjectsWidgetProps {
  projects: StatsProject[];
  height?: number;
  onExpand?: () => void;
  limit?: number;
  /** Quando true, o widget preenche 100% da altura do pai (usado no modal). */
  fillContainer?: boolean;
}

interface DatasetItem {
  label: string;
  color: string;
}

interface StackedDataset {
  label: string;
  data: number[];
  backgroundColor: string;
  stack: string;
  borderRadius: number;
  borderSkipped: false;
}

/**
 * Gráfico de barras empilhadas horizontais com o TOP N de projetos.
 *
 * A orientação horizontal resolve o problema de truncamento de nomes de
 * projeto: os labels ficam no eixo Y e ganham espaço à esquerda, sem
 * rotacionar nem cortar. A legenda de séries (status ou severidade) é
 * omitida do Nivo e reimplementada como pills compactas no header.
 */
export default function TopProjectsWidget({
  projects,
  height = 400,
  onExpand,
  limit = 8,
  fillContainer = false,
}: TopProjectsWidgetProps) {
  const pathname = usePathname();
  const { value: viewMode, setValue: setViewMode } = useSlideToggle<
    "severity" | "status"
  >(pathname, "dashboardProjectsView", "status");

  const { labels, datasets, legendItems } = useMemo(() => {
    if (!projects.length) {
      return {
        labels: [] as string[],
        datasets: [] as StackedDataset[],
        legendItems: [] as DatasetItem[],
      };
    }

    const sorted = [...projects]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, limit);

    const labels = sorted.map((p) => p.label);

    const items =
      viewMode === "status"
        ? ([
            { key: "open", label: "Aberta", color: STATUS_COLORS.open },
            {
              key: "recurring",
              label: "Recorrente",
              color: STATUS_COLORS.recurring,
            },
            {
              key: "resolved",
              label: "Corrigida",
              color: STATUS_COLORS.resolved,
            },
            {
              key: "wont_fix",
              label: "Não corrigir",
              color: STATUS_COLORS.wont_fix,
            },
          ] as const)
        : ([
            {
              key: "critical",
              label: "Crítico",
              color: SEVERITY_COLORS.critical,
            },
            { key: "high", label: "Alto", color: SEVERITY_COLORS.high },
            { key: "medium", label: "Médio", color: SEVERITY_COLORS.medium },
            { key: "low", label: "Baixo", color: SEVERITY_COLORS.low },
          ] as const);

    const datasets = items
      .filter((item) => sorted.some((p) => (p[viewMode]?.[item.key] ?? 0) > 0))
      .map<StackedDataset>((item) => ({
        label: item.label,
        data: sorted.map((p) => p[viewMode]?.[item.key] ?? 0),
        backgroundColor: item.color,
        stack: "stack0",
        borderRadius: 2,
        borderSkipped: false,
      }));

    const legendItems = items.map(({ label, color }) => ({ label, color }));

    return { labels, datasets, legendItems };
  }, [projects, viewMode, limit]);

  return (
    <div className="bg-elevated border border-default dark:border-none rounded-lg p-5 shadow-sm hover:drop-shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-heading shrink-0">
          Top projetos
        </h3>

        <div className="flex items-center gap-2 shrink-0">
          <SlideToggle
            options={[
              {
                key: "severity",
                label: "Severidade",
                activeClassName: "text-success",
              },
              {
                key: "status",
                label: "Status",
                activeClassName: "text-warning",
              },
            ]}
            value={viewMode}
            onChange={setViewMode}
            width={170}
            height={28}
            className="font-mono"
          />
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="btn-ghost p-1.5"
              title="Expandir gráfico"
              aria-label="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3">
          {legendItems.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      <div
        className="relative flex-1"
        style={fillContainer ? undefined : { minHeight: height }}
      >
        {datasets.length > 0 ? (
          <Charts
            datasets={datasets}
            labels={labels}
            type="stacked-bar"
            barLayout="horizontal"
            hideLegend
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Sem projetos para exibir.
          </div>
        )}
      </div>
    </div>
  );
}
