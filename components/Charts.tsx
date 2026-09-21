"use client";

import { useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  PieChart,
  LineChart,
  BarChart,
  pieClasses,
  rainbowSurgePalette,
  type LineSeriesType,
  type BarSeriesType,
  type PieSeriesType,
} from "@mui/x-charts";
import { Box } from "@mui/material";
import type { ChartDataPoint } from "@/lib/types";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

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
  colors?: string[];
  onSliceClick?: (label: string) => void;
}

const STATUS_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
const SEVERITY_COLORS = ["#EF4444", "#F97316", "#EAB308", "#3B82F6"];

export default function Charts({
  data,
  datasets,
  labels,
  type,
  colors,
  onSliceClick,
}: ChartsProps) {
  const mode = useResolvedTheme();
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

  const processed = useMemo(() => {
    // ============================================================
    // Múltiplos datasets (linha ou barras empilhadas)
    // ============================================================
    if (datasets && datasets.length > 0) {
      const isLine = type === "line";
      const isStackedBar = type === "stacked-bar";

      const isStatusData = datasets.some((ds: any) =>
        ["open", "resolved", "recurring", "wont_fix", "closed"].includes(
          String(ds.label).toLowerCase(),
        ),
      );
      const isSeverityData = datasets.some((ds: any) =>
        ["critical", "high", "medium", "low"].includes(
          String(ds.label).toLowerCase(),
        ),
      );

      const palette =
        (isStatusData && STATUS_COLORS) ||
        (isSeverityData && SEVERITY_COLORS) ||
        colors ||
        rainbowSurgePalette;

      if (isLine) {
        const lineSeries: LineSeriesType[] = datasets.map((ds, idx) => ({
          type: "line" as const,
          label: ds.label,
          data: ds.data,
          color:
            ds.borderColor ||
            ds.backgroundColor ||
            palette[idx % palette.length],
          showMark: true,
          curve: "natural",
          area: false,
        }));
        return {
          kind: "line" as const,
          xLabels: labels || datasets[0]?.labels || [],
          series: lineSeries,
        };
      }

      const barSeries: BarSeriesType[] = datasets.map((ds, idx) => ({
        type: "bar" as const,
        label: ds.label,
        data: ds.data,
        color:
          ds.borderColor || ds.backgroundColor || palette[idx % palette.length],
        stack: isStackedBar ? ds.stack || "stack0" : "total",
      }));
      return {
        kind: "bar" as const,
        xLabels: labels || datasets[0]?.labels || [],
        series: barSeries,
      };
    }

    // ============================================================
    // Barras individuais
    // ============================================================
    if (data && type === "project-detail") {
      const barSeries: BarSeriesType[] = [
        {
          data: data.map((d) => d.value),
          type: "bar",
          color: colors?.[0] ?? "#3B82F6",
        },
      ];
      return {
        kind: "bar" as const,
        xLabels: data.map((d) => d.label),
        series: barSeries,
      };
    }

    // ============================================================
    // Pizza
    // ============================================================
    if (data && type === "pie") {
      const pieSeries: PieSeriesType[] = [
        {
          type: "pie",
          data: data.map((d) => ({ label: d.label, value: d.value })),
          innerRadius: "30%",
          outerRadius: "80%",
          paddingAngle: 2,
          cornerRadius: 4,
          highlightScope: { fade: "global", highlight: "item" },
          faded: { additionalRadius: -20, color: "#CBD5E1" },
          arcLabel: (item: any) => (item.value > 50 ? String(item.value) : ""),
          arcLabelMinAngle: 30,
        },
      ];
      return {
        kind: "pie" as const,
        series: pieSeries,
        colors: rainbowSurgePalette,
      };
    }

    // ============================================================
    // Linha simples
    // ============================================================
    if (data && type === "line") {
      const lineSeries: LineSeriesType[] = [
        {
          type: "line",
          data: data.map((d) => d.value),
          color: colors?.[0] ?? "#3B82F6",
          curve: "natural",
          showMark: false,
          area: true,
        },
      ];
      return {
        kind: "line" as const,
        xLabels: data.map((d) => d.label),
        series: lineSeries,
      };
    }

    // ============================================================
    // Barras padrão
    // ============================================================
    const barSeries: BarSeriesType[] = [
      {
        type: "bar",
        data: data?.map((d) => d.value) || [],
        color: colors?.[0] ?? "#3B82F6",
      },
    ];
    return {
      kind: "bar" as const,
      xLabels: data?.map((d) => d.label) || [],
      series: barSeries,
    };
  }, [data, datasets, labels, type, colors]);

  // ============================================================
  // Estilos compartilhados
  // ============================================================
  const commonSx = {
    width: "100%",
    height: "100%",
    "& .MuiChartsAxis-tickLabel": {
      fill: "var(--mui-palette-text-secondary)",
      fontSize: 10,
    },
    "& .MuiChartsAxis-line": {
      stroke: "var(--mui-palette-divider)",
    },
    "& .MuiChartsAxis-tick": {
      stroke: "var(--mui-palette-divider)",
    },
    "& .MuiChartsLegend-label": {
      fill: "var(--mui-palette-text-secondary) !important",
      fontSize: "11px !important",
    },
    "& .MuiChartsLegend-root": {
      gap: "4px 8px",
    },
  };

  // ============================================================
  // Pizza
  // ============================================================
  if (processed.kind === "pie") {
    const series = processed.series as PieSeriesType[];
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ width: "100%", height: "100%", minWidth: 320 }}>
          <PieChart
            series={series}
            colors={processed.colors}
            onItemClick={(_event: any, item: any) => {
              if (onSliceClick && item?.label) {
                onSliceClick(String(item.label));
              }
            }}
            slotProps={{
              legend: {
                direction: "vertical",
                position: {
                  vertical: "middle",
                  horizontal: "end",
                },
              },
              tooltip: { trigger: "item" },
            }}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            sx={{
              ...commonSx,
              [`& .${pieClasses.arcLabel}`]: {
                fontWeight: 600,
                fill: "var(--mui-palette-common-white)",
                fontSize: 11,
              },
            }}
          />
        </Box>
      </ThemeProvider>
    );
  }

  // ============================================================
  // Linha
  // ============================================================
  if (processed.kind === "line") {
    const series = processed.series as LineSeriesType[];
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ width: "100%", height: "100%" }}>
          <LineChart
            series={series}
            xAxis={[{ scaleType: "band", data: processed.xLabels }]}
            slotProps={{
              legend: {
                direction: "horizontal",
                position: {
                  vertical: "middle",
                  horizontal: "center",
                },
              },
              tooltip: { trigger: "axis" },
            }}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            sx={commonSx}
          />
        </Box>
      </ThemeProvider>
    );
  }

  // ============================================================
  // Barras
  // ============================================================
  const barSeries = processed.series as BarSeriesType[];
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", height: "100%" }}>
        <BarChart
          series={barSeries}
          xAxis={[
            {
              scaleType: "band",
              data: processed.xLabels,
              tickLabelStyle: {
                fontSize: 10,
                fill: "var(--mui-palette-text-secondary)",
              },
            },
          ]}
          yAxis={[
            {
              tickLabelStyle: {
                fontSize: 10,
                fill: "var(--mui-palette-text-secondary)",
              },
            },
          ]}
          slotProps={{
            legend: {
              direction: "horizontal",
              position: {
                vertical: "middle",
                horizontal: "center",
              },
            },
            tooltip: { trigger: "axis" },
          }}
          margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
          sx={commonSx}
        />
      </Box>
    </ThemeProvider>
  );
}
