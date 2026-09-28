// lib/palette.ts

/**
 * Paleta central de cores para gráficos e dados.
 *
 * Por que constantes hex e não classes Tailwind?
 * Nivo (e libs de canvas/SVG) precisam de valores reais, não classes.
 * Estas constantes espelham os tokens do template (`globals.css`) para
 * garantir que a cor do gráfico bata com a cor da legenda/badge.
 */

export const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
} as const;

export const SEVERITY_LABELS = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
} as const;

export const STATUS_COLORS = {
  open: "#3b82f6",
  resolved: "#10b981",
  recurring: "#f59e0b",
  wont_fix: "#ef4444",
} as const;

export const STATUS_LABELS = {
  open: "Aberta",
  resolved: "Corrigida",
  recurring: "Recorrente",
  wont_fix: "Não corrigir",
} as const;

export const CATEGORY_COLORS = [
  "#911eb4",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#e6194B",
  "#469990",
  "#dcbeff",
  "#9A6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#393b79",
  "#5254a3",
  "#6b6ecf",
  "#9c9ede",
  "#637939",
  "#8ca252",
  "#b5cf6b",
  "#cedb9c",
  "#8c6d31",
  "#bd9e39",
  "#e7ba52",
  "#e7cb94",
  "#843c39",
  "#ad494a",
  "#d6616b",
];

export type SeverityKey = keyof typeof SEVERITY_COLORS;
export type StatusKey = keyof typeof STATUS_COLORS;
