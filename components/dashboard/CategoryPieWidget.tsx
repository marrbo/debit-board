// components/dashboard/CategoryPieWidget.tsx
"use client";

import { Maximize2 } from "lucide-react";
import Charts from "@/components/Charts";
import type { StatsCategory } from "@/types/IStats";

interface CategoryPieWidgetProps {
  categories: StatsCategory[];
  height?: number;
  onExpand?: () => void;
  /**
   * Quando `true`, o gráfico preenche 100% da altura do pai
   * (usado no modal expandido). Quando `false` (default), usa
   * `minHeight: height` para não colapsar em spans estreitos.
   */
  fillContainer?: boolean;
}

/**
 * Gráfico de pizza da distribuição por categoria.
 *
 * Complementa o widget "Distribuição por Categoria" (que usa
 * `TeamStatsCard` com barra + legenda): aqui o foco é a leitura
 * proporcional rápida das fatias. Ambos consomem o mesmo array
 * `stats.categoryTotals`, então qualquer mudança nos dados
 * aparece nos dois lugares simultaneamente.
 */
export default function CategoryPieWidget({
  categories,
  height = 300,
  onExpand,
  fillContainer = false,
}: CategoryPieWidgetProps) {
  return (
    <div className="bg-elevated border border-default dark:border-none rounded-lg p-5 shadow-sm hover:drop-shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-heading shrink-0 truncate">
          Pizza por Categoria
        </h3>
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

      <div
        className="relative flex-1"
        style={fillContainer ? undefined : { minHeight: height }}
      >
        {categories.length > 0 ? (
          <Charts data={categories} type="pie" />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Sem categorias para exibir.
          </div>
        )}
      </div>
    </div>
  );
}
