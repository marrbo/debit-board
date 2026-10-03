// components/ScanRiskTimeline.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import Charts from "@/components/Charts";
import { BAND_META, bandOf, type RiskBand } from "@/lib/risk";

interface TimelinePoint {
  _id: string;
  scanDate: string;
  riskScore: number;
  riskBand?: RiskBand;
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
}

interface ReferencePoint {
  _id: string;
  scanDate: string;
  riskScore: number;
}

export interface TimelineRange {
  start: number;
  end: number;
}

interface ScanRiskTimelineProps {
  points: TimelinePoint[];
  height?: number;
  compact?: boolean;
  fillContainer?: boolean;
  showCaption?: boolean;
  trendLine?: boolean;
  medianLine?: boolean;
  selectable?: boolean;
  selectedRange?: TimelineRange | null;
  onRangeSelect?: (range: TimelineRange | null) => void;
  referencePoints?: ReferencePoint[];
  yScaleMode?: "zero" | "auto";
  yTickStep?: number;
}

const LINE_COLOR = "#60a5fa";
const TREND_COLOR = "#f59e0b";
const MEDIAN_COLOR = "#a78bfa";
const TENANT_COLOR = "rgba(148, 163, 184, 0.55)";
const PENDING_COLOR = "#a855f7";
const MUTED_COLOR = "#475569";

const RISK_SERIES_ID = "Risco";
const TENANT_SERIES_ID = "Tenant";

function linearRegression(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values.slice();

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  return values.map((_, i) =>
    Math.max(0, Math.min(100, intercept + slope * i)),
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export default function ScanRiskTimeline({
  points,
  height = 220,
  compact = false,
  fillContainer = false,
  showCaption,
  trendLine = true,
  medianLine = true,
  selectable = false,
  selectedRange = null,
  onRangeSelect,
  referencePoints,
  yScaleMode = "auto",
  yTickStep = 10,
}: ScanRiskTimelineProps) {
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const showCaptionResolved = showCaption ?? !compact;

  const hasReference =
    referencePoints !== undefined &&
    referencePoints.length === points.length &&
    points.length > 0;

  const labels = useMemo(
    () =>
      points.map((p) => {
        const d = new Date(p.scanDate);
        return d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
      }),
    [points],
  );

  const datasets = useMemo(() => {
    const teamScores = points.map((p) => p.riskScore);
    const out: any[] = [
      {
        label: RISK_SERIES_ID,
        data: teamScores,
        borderColor: LINE_COLOR,
        backgroundColor: "transparent",
      },
    ];

    if (hasReference) {
      out.push({
        label: TENANT_SERIES_ID,
        data: referencePoints!.map((r) => r.riskScore),
        // Alpha 55% simula linha "mais fina" sem precisar de stroke-width variável
        borderColor: TENANT_COLOR,
        backgroundColor: "transparent",
      });
    }

    if (trendLine && points.length >= 3) {
      out.push({
        label: "Tendência",
        data: linearRegression(teamScores),
        borderColor: TREND_COLOR,
        backgroundColor: "transparent",
      });
    }

    return out;
  }, [points, referencePoints, hasReference, trendLine]);

  const pointColor = useMemo(
    () =>
      (point: any): string => {
        const value = point?.data?.y;
        if (typeof value !== "number") return LINE_COLOR;

        const serieId = point?.serieId;
        if (serieId === TENANT_SERIES_ID) return "transparent";

        const index = point?.index;
        if (selectable && pendingStart !== null && index === pendingStart) {
          return PENDING_COLOR;
        }
        if (
          selectedRange &&
          typeof index === "number" &&
          (index < selectedRange.start || index > selectedRange.end)
        ) {
          return MUTED_COLOR;
        }
        return BAND_META[bandOf(value)].hex;
      },
    [selectable, pendingStart, selectedRange],
  );

  const handlePointClick = useCallback(
    (point: any) => {
      if (!selectable || !onRangeSelect) return;
      if (point?.serieId !== RISK_SERIES_ID) return;
      const index = point?.index;
      if (typeof index !== "number") return;

      if (pendingStart === null) {
        setPendingStart(index);
        return;
      }
      if (pendingStart === index) {
        setPendingStart(null);
        return;
      }

      const start = Math.min(pendingStart, index);
      const end = Math.max(pendingStart, index);
      setPendingStart(null);
      onRangeSelect({ start, end });
    },
    [selectable, onRangeSelect, pendingStart],
  );

  const { computedYMin, computedYTicks } = useMemo(() => {
    if (yScaleMode === "zero" || points.length === 0) {
      return { computedYMin: 0, computedYTicks: undefined };
    }
    const allValues = [
      ...points.map((p) => p.riskScore),
      ...(referencePoints?.map((r) => r.riskScore) ?? []),
    ];
    const minRisk = Math.min(...allValues);
    const floor = Math.max(
      0,
      Math.floor(minRisk / yTickStep) * yTickStep - yTickStep,
    );
    const ticks: number[] = [];
    for (let v = floor; v <= 100; v += yTickStep) ticks.push(v);
    return { computedYMin: floor, computedYTicks: ticks };
  }, [points, referencePoints, yScaleMode, yTickStep]);

  if (points.length === 0) {
    return (
      <div
        className={`w-full flex items-center justify-center text-sm text-muted text-center ${
          fillContainer ? "h-full" : ""
        }`}
        style={fillContainer ? undefined : { minHeight: height }}
      >
        Nenhum scan concluído para exibir.
      </div>
    );
  }

  const avg = points.reduce((s, p) => s + p.riskScore, 0) / points.length;
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.riskScore - first.riskScore;
  const med = median(points.map((p) => p.riskScore));

  const wrapperClass = fillContainer
    ? "w-full h-full flex flex-col"
    : "w-full flex flex-col";
  const wrapperStyle = fillContainer ? undefined : { minHeight: height };
  const chartWrapperStyle = fillContainer
    ? undefined
    : { minHeight: showCaptionResolved ? height - 40 : height };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="relative flex-1 min-h-0" style={chartWrapperStyle}>
        <Charts
          datasets={datasets}
          labels={labels}
          type="line"
          hideLegend
          compact={compact}
          pointColor={pointColor}
          curve="monotoneX"
          yMin={computedYMin}
          yMax={100}
          yTickValues={computedYTicks}
          onPointClick={selectable ? handlePointClick : undefined}
          referenceLines={
            medianLine && points.length >= 2
              ? [{ value: med, label: "Mediana", color: MEDIAN_COLOR }]
              : undefined
          }
          tooltipRenderer={(slice) => (
            <TimelineTooltip
              slice={slice}
              points={points}
              referencePoints={hasReference ? referencePoints : undefined}
            />
          )}
        />
      </div>

      {showCaptionResolved && (
        <div className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted shrink-0">
          <span>
            Média:{" "}
            <span className="text-heading font-medium">{avg.toFixed(1)}</span>
          </span>
          <span>
            Atual:{" "}
            <span className="text-heading font-medium">
              {last.riskScore} ({BAND_META[bandOf(last.riskScore)].label})
            </span>
          </span>
          <span>
            Variação:{" "}
            <span
              className={
                delta > 0
                  ? "text-red-400 font-medium"
                  : delta < 0
                    ? "text-emerald-400 font-medium"
                    : "text-heading font-medium"
              }
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(0)}
            </span>
          </span>
          <span>Mediana: {med.toFixed(1)}</span>
          <span className="text-muted">{points.length} scans no período</span>
          {selectable && (
            <span className="text-muted italic ml-auto">
              {pendingStart !== null
                ? "Clique no ponto final para filtrar"
                : selectedRange
                  ? "Clique em 2 pontos para refinar o filtro"
                  : "Clique em 2 pontos para filtrar o período"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface TimelineTooltipProps {
  slice: any;
  points: TimelinePoint[];
  referencePoints?: ReferencePoint[];
}

function TimelineTooltip({
  slice,
  points,
  referencePoints,
}: TimelineTooltipProps) {
  const firstPoint = slice.points[0];
  const xIndex = firstPoint?.data?.x;
  const point = typeof xIndex === "number" ? points[xIndex] : null;
  const ref =
    referencePoints && typeof xIndex === "number"
      ? referencePoints[xIndex]
      : null;

  if (!point) return null;

  const meta = BAND_META[bandOf(point.riskScore)];

  return (
    <div className="bg-[#161b22] border border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
      <div className="text-gray-400 text-[10px]">
        {new Date(point.scanDate).toLocaleString("pt-BR")}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
        <span className="text-white font-semibold">{point.riskScore}</span>
        <span className={meta.text}>{meta.label}</span>
      </div>
      {ref && (
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[#94a3b8]" />
          <span className="text-gray-300">
            Tenant: <span className="font-medium">{ref.riskScore}</span>
          </span>
        </div>
      )}
      <div className="mt-1 text-[10px] text-gray-400">
        {point.totalOccurrences} ocorrências · {point.patternCount} patterns
      </div>
      {point.failedPatterns > 0 && (
        <div className="text-[10px] text-red-400">
          {point.failedPatterns} falha
          {point.failedPatterns > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
