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
    // ================= MÚLTIPLOS DATASETS (LINHA OU BARRAS EMPILHADAS) =================
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
        const lineSeries: LineSeriesType[] = datasets.map((ds, idx) => {
          const baseColor =
            ds.borderColor || ds.backgroundColor || palette[idx % palette.length];
          return {
            type: "line" as const,
            label: ds.label,
            data: ds.data,
            color: baseColor,
            showMark: true,
            mark: "circle",
            curve: "natural",
            area: true,
          };
        });
        return {
          type: "line" as const,
          xLabels: labels || datasets[0]?.labels || [],
          series: lineSeries,
        };
      }

      const barSeries: BarSeriesType[] = datasets.map((ds, idx) => {
        const baseColor =
          ds.borderColor || ds.backgroundColor || palette[idx % palette.length];
        return {
          type: "bar" as const,
          label: ds.label,
          data: ds.data,
          barLabel: "value",
          barLabelPlacement: "outside",
          color: baseColor,
          stack: isStackedBar ? (ds.stack || "stack0") : "total",
          borderRadius: 5,
        };
      });
      return {
        type: "bar" as const,
        xLabels: labels || datasets[0]?.labels || [],
        series: barSeries,
      };
    }

    // ================= BARRAS INDIVIDUAIS (PROJECT DETAIL) =================
    if (data && type === "project-detail") {
      const barData = data.map((d: ChartDataPoint) => d.value);
      const barSeries: BarSeriesType[] = [
        {
          data: barData,
          type: "bar",
          color: colors?.[0] ?? "#3B82F6",
        },
      ];
      return {
        type: "bar" as const,
        xLabels: data.map((d) => d.label),
        series: barSeries,
      };
    }

    // ================= PIZZA (Categoria) =================
    if (data && type === "pie") {
      const pieSeries: PieSeriesType[] = [
        {
          type: "pie",
          data: data.map((d) => ({ label: d.label, value: d.value })),
          innerRadius: "30%",
          outerRadius: "90%",
          paddingAngle: 5,
          cornerRadius: 8,
          highlightScope: { fade: "global", highlight: "item" },
          faded: { innerRadius: 30, additionalRadius: -30, color: "#C0C0C0" },
          arcLabel: (item: any) => `${item.value}`,
          arcLabelMinAngle: 35,
        },
      ];
      return {
        type: "pie" as const,
        series: pieSeries,
        colors: rainbowSurgePalette,
      };
    }

    // ================= LINHA SIMPLES =================
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
        type: "line" as const,
        xLabels: data.map((d) => d.label),
        series: lineSeries,
      };
    }

    // ================= BARRAS PADRÃO =================
    const barSeries: BarSeriesType[] = [
      {
        type: "bar",
        data: data?.map((d) => d.value) || [],
        color: colors?.[0] ?? "#3B82F6",
        minBarSize: 10,
      },
    ];
    return {
      type: "bar" as const,
      xLabels: data?.map((d) => d.label) || [],
      series: barSeries,
    };
  }, [data, datasets, labels, type, colors]);

  // 🔹 CSS Variables nativas — atualização instantânea sem recarregar estado.
  const commonSx = {
    width: "100%",
    height: "100%",
    "& .MuiChartsLegend-series text": {
      fill: "var(--mui-palette-text-primary)",
    },
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
    "& .MuiChartsAxis-label": {
      fill: "var(--mui-palette-text-secondary)",
    },
    "& .MuiChartsLegend-root": {
      justifyContent: "center",
    },
    "& .MuiChartsLegend-series": {
      display: "flex",
    },
  };

  // ===== RENDER: PIZZA =====
  if (processed.type === "pie") {
    const series = processed.series as PieSeriesType[];
    return (
      <ThemeProvider theme={theme}>
        <PieChart
          series={series}
          colors={processed.colors}
          onItemClick={(_event: any, item: any) => {
            if (onSliceClick && item?.label) onSliceClick(String(item.label));
          }}
          sx={{
            ...commonSx,
            [`& .${pieClasses.arcLabel}`]: {
              fontWeight: "bold",
              fill: "var(--mui-palette-text-primary)",
            },
          }}
        />
      </ThemeProvider>
    );
  }

  // ===== RENDER: LINHA =====
  if (processed.type === "line") {
    const series = processed.series as LineSeriesType[];
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ width: "100%", height: "100%" }}>
          <LineChart
            series={series}
            xAxis={[
              {
                scaleType: "band",
                data: processed.xLabels,
              },
            ]}
            sx={commonSx}
          />
        </Box>
      </ThemeProvider>
    );
  }

  // ===== RENDER: BARRAS =====
  const barSeries = processed.series as BarSeriesType[];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={commonSx}>
        <BarChart
          series={barSeries}
          xAxis={[
            {
              scaleType: "band",
              data: processed.xLabels,
              tickLabelStyle: {
                angle: -35,
                textAnchor: "end",
                fontSize: 10,
              },
              tickInterval: "auto",
            },
          ]}
          margin={{ left: 20, right: 20, top: 20, bottom: 80 }}
          slotProps={{
            legend: {
              direction: "horizontal",
              position: { vertical: "top", horizontal: "center" },
            },
          }}
          sx={{
            ...commonSx,
            "& .MuiChartsLegend-root": {
              maxHeight: 48,
              overflow: "auto",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "4px 16px",
            },
            "& .MuiChartsLegend-series": {
              display: "flex",
              alignItems: "center",
            },
          }}
        />
      </Box>
    </ThemeProvider>
  );
}