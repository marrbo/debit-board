"use client";

import { useMemo } from "react";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import type { ChartDataPoint } from "@/lib/types";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

// ============================================================
// Tipos
// ============================================================
type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "project"
  | "project-detail"
  | "stacked-bar";

interface ChartsProps {
  data?: ChartDataPoint[];
  datasets?: any[];
  labels?: string[];
  type: ChartType;
  onSliceClick?: (label: string) => void;
}

// ============================================================
// Paleta compartilhada
// ============================================================
const PIE_COLORS = [
  "#e8c1a0",
  "#f47560",
  "#f1e15b",
  "#e8a838",
  "#61cdbb",
  "#97e3d5",
  "#e25c60",
  "#be7cb0",
  "#9dbcd4",
  "#a1c9f4",
];

// ============================================================
// Tema Nivo
// ============================================================
const getNivoTheme = (mode: "light" | "dark") => {
  const isDark = mode === "dark";
  return {
    background: "transparent",
    text: {
      fontSize: 11,
      fill: isDark ? "#94A3B8" : "#64748B",
      fontFamily: "inherit",
    },
    axis: {
      domain: {
        line: { stroke: isDark ? "#334155" : "#E2E8F0", strokeWidth: 1 },
      },
      ticks: {
        line: { stroke: isDark ? "#334155" : "#E2E8F0", strokeWidth: 1 },
        text: { fontSize: 10, fill: isDark ? "#94A3B8" : "#64748B" },
      },
      legend: {
        text: {
          fontSize: 11,
          fill: isDark ? "#CBD5E1" : "#475569",
          fontWeight: 600,
        },
      },
    },
    grid: {
      line: { stroke: isDark ? "#1E293B" : "#F1F5F9", strokeWidth: 1 },
    },
    legends: {
      text: {
        fontSize: 10,
        fill: isDark ? "#CBD5E1" : "#475569",
      },
    },
    tooltip: {
      container: {
        background: isDark ? "#1E293B" : "#FFFFFF",
        color: isDark ? "#F1F5F9" : "#1E293B",
        fontSize: 12,
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: 0.5,
      },
    },
    crosshair: {
      line: {
        stroke: isDark ? "#475569" : "#CBD5E1",
        strokeWidth: 1,
        strokeDasharray: "4 4",
      },
    },
  };
};

// ============================================================
// Helpers
// ============================================================
function buildLineData(datasets: any[]) {
  return datasets.map((ds) => ({
    id: ds.label,
    color: ds.borderColor || ds.backgroundColor,
    data: ds.data.map((value: number, idx: number) => ({ x: idx, y: value })),
  }));
}

function buildBarData(labels: string[], datasets: any[]) {
  const colors = datasets.map((ds) => ds.backgroundColor);
  const keys = datasets.map((ds) => ds.label);
  const data = labels.map((label, idx) => {
    const row: Record<string, any> = { index: label };
    datasets.forEach((ds) => {
      row[ds.label] = ds.data[idx] || 0;
    });
    return row;
  });
  return { data, keys, colors };
}

function truncate(s: string, max = 18) {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ============================================================
// Tooltip customizado — mostra TODAS as séries no mesmo X
// ============================================================
interface LineSliceTooltipProps {
  slice: any;
  xLabels: string[];
  isDark: boolean;
  /** Labels das séries na ORDEM em que foram passadas ao Nivo.
   *  Usado como fallback quando o Nivo não expõe `serieId`. */
  seriesLabels: string[];
  /** Cores das séries na mesma ordem. */
  seriesColors: string[];
}

function LineSliceTooltip({
  slice,
  xLabels,
  isDark,
  seriesLabels,
  seriesColors,
}: LineSliceTooltipProps) {
  const firstPoint = slice.points[0];
  const xIndex = firstPoint?.data?.x;
  const xLabel =
    typeof xIndex === "number" && xLabels[xIndex]
      ? xLabels[xIndex]
      : String(firstPoint?.data?.xFormatted ?? xIndex ?? "");

  // 🔑 Preserva o índice ORIGINAL antes de ordenar.
  //    A ordem de `slice.points` no Nivo espelha a ordem das séries
  //    passadas em `data`, então `originalIdx` mapeia 1:1 com `seriesLabels`.
  const indexed = slice.points.map((point: any, originalIdx: number) => ({
    point,
    originalIdx,
  }));

  const sorted = indexed
    .filter(({ point }) => (point.data?.y ?? 0) > 0)
    .sort((a: any, b: any) => (b.point.data?.y ?? 0) - (a.point.data?.y ?? 0));

  const bg = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  const textPrimary = isDark ? "#F1F5F9" : "#1E293B";
  const textSecondary = isDark ? "#94A3B8" : "#64748B";

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        fontSize: 11,
        minWidth: 220,
      }}
    >
      <div
        style={{
          color: textPrimary,
          fontWeight: 600,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `1px solid ${border}`,
        }}
      >
        {xLabel}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sorted.map(({ point, originalIdx }: any, renderIdx: number) => {
          // 🔑 Cascata de fallback:
          // 1. `serieId` (nome)
          // 2. `series.id` (nome aninhado)
          // 3. `seriesLabels[originalIdx]` (nome passado por prop)
          // 4. fallback numérico
          const serieLabel =
            (typeof point.serieId === "string" && point.serieId) ||
            (typeof point.series?.id === "string" && point.series.id) ||
            seriesLabels[originalIdx] ||
            `Série ${originalIdx + 1}`;

          // Cor: mesma cascata
          const serieColor =
            (typeof point.serieColor === "string" && point.serieColor) ||
            (typeof point.series?.color === "string" && point.series.color) ||
            seriesColors[originalIdx] ||
            "#94A3B8";

          return (
            <div
              key={`${originalIdx}-${renderIdx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: serieColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: textSecondary,
                  flex: "1 1 0",
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {serieLabel}
              </span>
              <span
                style={{
                  color: textPrimary,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {point.data?.yFormatted ?? point.data?.y ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Componente
// ============================================================
export default function Charts({
  data,
  datasets,
  labels,
  type,
  onSliceClick,
}: ChartsProps) {
  const mode = useResolvedTheme();
  const theme = useMemo(() => getNivoTheme(mode), [mode]);
  const isDark = mode === "dark";

  // ============================================================
  // Multi-dataset: linha ou barras empilhadas
  // ============================================================
  if (datasets && datasets.length > 0) {
    // ---------- LINHA ----------
    if (type === "line") {
      const lineData = buildLineData(datasets);
      const xLabels = labels || datasets[0]?.labels || [];
      const legendRows = Math.ceil(lineData.length / 3);

      // 🔑 Props auxiliares para o tooltip — evita depender do Nivo expor
      //    `serieId`/`serieColor` (que varia entre versões).
      const seriesLabels = lineData.map((d) => d.id);
      const seriesColors = lineData.map((d) => d.color);

      return (
        <ResponsiveLine
          data={lineData}
          theme={theme}
          margin={{
            top: 20,
            right: 20,
            bottom: 20 + legendRows * 22,
            left: 45,
          }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: 0, max: "auto" }}
          curve="monotoneX"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 6,
            tickRotation: -30,
            format: (idx) => truncate(xLabels[idx] || String(idx), 12),
          }}
          axisLeft={{ tickSize: 5, tickPadding: 6, tickRotation: 0 }}
          enableGridX={false}
          colors={datasets.map((ds) => ds.borderColor || ds.backgroundColor)}
          lineWidth={2}
          enablePoints
          pointSize={6}
          pointColor={{ theme: "background" }}
          pointBorderWidth={2}
          pointBorderColor={{ from: "serieColor" }}
          useMesh
          motionConfig="gentle"
          enableSlices="x"
          sliceTooltip={(props) => (
            <LineSliceTooltip
              slice={props.slice}
              xLabels={xLabels}
              isDark={isDark}
              seriesLabels={seriesLabels}
              seriesColors={seriesColors}
            />
          )}
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              justify: true,
              translateX: 0,
              translateY: 55,
              itemsSpacing: 4,
              itemWidth: 75,
              itemHeight: 18,
              itemDirection: "left-to-right",
              itemOpacity: 0.85,
              symbolSize: 6,
              symbolShape: "circle",
            },
          ]}
        />
      );
    }

    // ---------- BARRAS EMPILHADAS (legenda no topo) ----------
    const {
      data: barData,
      keys,
      colors: barColors,
    } = buildBarData(labels || [], datasets);

    return (
      <ResponsiveBar
        data={barData}
        theme={theme}
        keys={keys}
        indexBy="index"
        margin={{ top: 45, right: 20, bottom: 100, left: 45 }}
        padding={0.5}
        groupMode="stacked"
        colors={barColors}
        borderRadius={3}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 6,
          tickRotation: -45,
          format: (v) => truncate(String(v), 14),
        }}
        axisLeft={{ tickSize: 5, tickPadding: 6, tickRotation: 0 }}
        enableGridX={false}
        labelSkipWidth={16}
        labelSkipHeight={16}
        labelTextColor="#FFFFFF"
        motionConfig="gentle"
        role="application"
        ariaLabel="Gráfico de barras empilhadas"
        legends={[
          {
            dataFrom: "keys",
            anchor: "top",
            direction: "row",
            justify: false,
            translateX: 0,
            translateY: -38,
            itemsSpacing: 20,
            itemWidth: 60,
            itemHeight: 18,
            itemDirection: "left-to-right",
            itemOpacity: 0.9,
            symbolSize: 8,
            symbolShape: "circle",
          },
        ]}
      />
    );
  }

  // ============================================================
  // Pizza
  // ============================================================
  if (data && type === "pie") {
    const pieData = data.map((d) => ({
      id: d.label,
      label: d.label,
      value: d.value,
    }));

    return (
      <ResponsivePie
        data={pieData}
        theme={theme}
        margin={{ top: 20, right: 150, bottom: 20, left: 20 }}
        innerRadius={0.55}
        padAngle={1.5}
        cornerRadius={4}
        activeOuterRadiusOffset={8}
        colors={PIE_COLORS}
        borderWidth={0}
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={15}
        arcLabelsTextColor="#FFFFFF"
        arcLabel={(d) => `${d.value}`}
        onClick={(slice) => {
          if (onSliceClick && slice.label) {
            onSliceClick(String(slice.label));
          }
        }}
        motionConfig="gentle"
        legends={[
          {
            anchor: "right",
            direction: "column",
            justify: false,
            translateX: 140,
            translateY: 0,
            itemsSpacing: 6,
            itemWidth: 130,
            itemHeight: 18,
            itemTextColor: isDark ? "#CBD5E1" : "#475569",
            itemDirection: "left-to-right",
            itemOpacity: 0.9,
            symbolSize: 8,
            symbolShape: "circle",
            data: pieData.map((d, i) => ({
              id: d.id,
              label: truncate(d.label, 20),
              color: PIE_COLORS[i % PIE_COLORS.length],
            })),
          },
        ]}
      />
    );
  }

  // ============================================================
  // Fallback — barras simples
  // ============================================================
  const simpleBarData = (data || []).map((d) => ({
    index: truncate(d.label, 14),
    value: d.value,
  }));

  return (
    <ResponsiveBar
      data={simpleBarData}
      theme={theme}
      keys={["value"]}
      indexBy="index"
      margin={{ top: 20, right: 20, bottom: 100, left: 45 }}
      padding={0.5}
      colors="#3B82F6"
      borderRadius={3}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 6,
        tickRotation: -45,
      }}
      axisLeft={{ tickSize: 5, tickPadding: 6, tickRotation: 0 }}
      enableGridX={false}
      motionConfig="gentle"
      role="application"
      ariaLabel="Gráfico de barras"
    />
  );
}
