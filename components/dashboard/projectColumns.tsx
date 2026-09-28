// components/dashboard/projectColumns.tsx
"use client";

import type { Column } from "@/components/DataTable";
import { drawSeverityShields } from "@/components/DataTable/pdfShared";

/**
 * Estilo de célula Excel para as sub-colunas de severidade.
 * Reutilizado pelas 4 colunas (Crítico / Alto / Médio / Baixo).
 */
function applySeverityCellStyle(
  cell: any,
  value: number,
  palette: { fill: string; font: string },
) {
  cell.value = value;
  cell.alignment = { vertical: "middle", horizontal: "center" };
  if (value > 0) {
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: palette.font },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: palette.fill },
    };
  } else {
    cell.font = { name: "Arial", size: 10, color: { argb: "FF94A3B8" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
  }
}

/**
 * Colunas da tabela de Projetos.
 *
 * Compartilhado entre `app/page.tsx` (Dashboard) e `app/tv/TVClient.tsx`
 * (modo TV) para garantir identidade visual e contrato idêntico de
 * renderização (tela, PDF e Excel).
 */
export const projectColumns: Column<any>[] = [
  { key: "name", width: "250px", label: "Projeto", sortable: true },
  {
    key: "observationSeverityCounts",
    label: "Severidade",
    sortable: false,
    width: "260px",
    align: "center",
    className: "hover:scale-150 hover:translate-x-16 translate-x-10",
    pdfCellRenderer: (doc, cell, item, extraData) => {
      const sev = extraData?.[item.name]?.severity || {};
      drawSeverityShields(
        doc,
        cell.cell.x,
        cell.cell.y,
        sev,
        cell.cell.width,
        cell.cell.height,
      );
    },
    excelSubColumns: [
      {
        label: "Crítico",
        width: 80,
        render: (item, extraData) =>
          extraData?.[item.name]?.severity?.critical || 0,
        excelCellRenderer: (cell, item, extraData) =>
          applySeverityCellStyle(
            cell,
            extraData?.[item.name]?.severity?.critical || 0,
            { fill: "FFFEE2E2", font: "FF991B1B" },
          ),
      },
      {
        label: "Alto",
        width: 80,
        render: (item, extraData) =>
          extraData?.[item.name]?.severity?.high || 0,
        excelCellRenderer: (cell, item, extraData) =>
          applySeverityCellStyle(
            cell,
            extraData?.[item.name]?.severity?.high || 0,
            { fill: "FFFED7AA", font: "FF9A3412" },
          ),
      },
      {
        label: "Médio",
        width: 80,
        render: (item, extraData) =>
          extraData?.[item.name]?.severity?.medium || 0,
        excelCellRenderer: (cell, item, extraData) =>
          applySeverityCellStyle(
            cell,
            extraData?.[item.name]?.severity?.medium || 0,
            { fill: "FFFEF3C7", font: "FF92400E" },
          ),
      },
      {
        label: "Baixo",
        width: 80,
        render: (item, extraData) => extraData?.[item.name]?.severity?.low || 0,
        excelCellRenderer: (cell, item, extraData) =>
          applySeverityCellStyle(
            cell,
            extraData?.[item.name]?.severity?.low || 0,
            { fill: "FFDCFCE7", font: "FF166534" },
          ),
      },
    ],
    render: (item: any, extraData?: Record<string, any>) => {
      const sev = extraData?.[item.name]?.severity || {};
      const items = [
        {
          letter: "C",
          count: sev.critical || 0,
          color: "#ef4444",
          label: "Critical",
        },
        { letter: "H", count: sev.high || 0, color: "#f97316", label: "High" },
        {
          letter: "M",
          count: sev.medium || 0,
          color: "#eab308",
          label: "Medium",
        },
        { letter: "L", count: sev.low || 0, color: "#22c55e", label: "Low" },
      ];

      return (
        <div className="flex items-center gap-2">
          {items.map((it) => (
            <div
              key={it.letter}
              className="flex flex-col items-center gap-0.5"
              title={`${it.label}: ${it.count}`}
            >
              <div className="relative w-7 h-8">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
                    fill={it.color}
                  />
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
                    fill="none"
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="0.8"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[11px]">
                  {it.letter}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-muted">
                {it.count}
              </span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    key: "description",
    label: "Descrição",
    sortable: true,
    exportable: false,
    className:
      "text-ellipsis text-muted italic font-mono text-xs line-clamp-1 text-wrap",
  },
  {
    key: "lastScan",
    label: "Last scan",
    sortable: true,
    width: "120px",
    align: "center",
    render: (item: any) => {
      if (!item.syncDate) return "—";
      const diff = Date.now() - new Date(item.syncDate).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return "há menos de 1h";
      if (hours < 24) return `há ${hours}h`;
      return `há ${Math.floor(hours / 24)}d`;
    },
  },
];
