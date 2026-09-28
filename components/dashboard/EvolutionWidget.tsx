// components/dashboard/EvolutionWidget.tsx
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Maximize2 } from "lucide-react";
import Charts from "@/components/Charts";
import SlideToggle from "@/components/SlideToggle";
import { useSlideToggle } from "@/hooks/useLocalSettings";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/lib/palette";
import type { DailyStats } from "@/types/IStats";

interface EvolutionWidgetProps {
  chartData: DailyStats[];
  height?: number;
  onExpand?: () => void;
  /** Quando true, o widget preenche 100% da altura do pai (usado no modal). */
  fillContainer?: boolean;
}

interface DatasetItem {
  label: string;
  color: string;
}

interface NivoDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  pointRadius: number;
  pointBackgroundColor: string;
  tension: number;
  fill: boolean;
}

/**
 * Gráfico de linha da evolução das ocorrências por dia.
 *
 * A legenda nativa do Nivo é desabilitada em favor de uma legenda
 * custom acima do gráfico — evita colisão com o eixo quando a altura
 * é pequena.
 */
export default function EvolutionWidget({
  chartData,
  height = 400,
  onExpand,
  fillContainer = false,
}: EvolutionWidgetProps) {
  const pathname = usePathname();
  const { value: viewMode, setValue: setViewMode } = useSlideToggle<
    "severity" | "status"
  >(pathname, "dashboardEvolutionView", "severity");

  const { datasets, legendItems, labels } = useMemo(() => {
    const filtered = chartData.filter((d) => d.total > 0);

    if (!filtered.length) {
      return {
        labels: [] as string[],
        datasets: [] as NivoDataset[],
        legendItems: [] as DatasetItem[],
      };
    }

    const labels = filtered.map((d) => {
      const [, month, day] = d.label.split("-");
      return `${day}/${month}`;
    });

    const items =
      viewMode === "severity"
        ? ([
            {
              key: "critical",
              label: "Crítico",
              color: SEVERITY_COLORS.critical,
            },
            { key: "high", label: "Alto", color: SEVERITY_COLORS.high },
            { key: "medium", label: "Médio", color: SEVERITY_COLORS.medium },
            { key: "low", label: "Baixo", color: SEVERITY_COLORS.low },
          ] as const)
        : ([
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
              key: "wontFix",
              label: "Não corrigir",
              color: STATUS_COLORS.wont_fix,
            },
          ] as const);

    const datasets = items.map<NivoDataset>((item) => ({
      label: item.label,
      data: filtered.map((d) => d[item.key as keyof DailyStats] as number),
      borderColor: item.color,
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: item.color,
      tension: 0.3,
      fill: false,
    }));

    const legendItems = items.map(({ label, color }) => ({ label, color }));

    return { labels, datasets, legendItems };
  }, [chartData, viewMode]);

  return (
    <div className="bg-elevated border border-default dark:border-none rounded-lg p-5 shadow-sm hover:drop-shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-heading shrink-0">
          Evolução das ocorrências
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

      {/* Legenda custom — discreta, alinhada à esquerda */}
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
          <Charts datasets={datasets} labels={labels} type="line" hideLegend />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Sem dados no período selecionado.
          </div>
        )}
      </div>
    </div>
  );
}
