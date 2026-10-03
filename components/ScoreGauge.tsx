"use client";

import { BAND_META, bandOf } from "@/lib/risk";

type ScoreGaugeStyle = "segmented" | "progress";

interface ScoreGaugeProps {
  /** 0–100. */
  score: number;
  /** Diâmetro externo em px. Default 90. */
  size?: number;
  /**
   * `full` (default): número + label da banda.
   * `compact`: só o número — útil em títulos e cards pequenos.
   */
  variant?: "full" | "compact";
  /**
   * `segmented` (default): 5 segmentos coloridos, espectro completo
   * sempre visível, indicador desliza até o score.
   * `progress`: arco monocromático na cor da banda atual.
   */
  style?: ScoreGaugeStyle;
  className?: string;
}

// ============================================================
// Geometria — fixa em viewBox units
// ------------------------------------------------------------
// viewBox: 36 × 20
// cx = 18 (centro horizontal), cy = 18 (base do arco)
// r = 15.5 (deixa ~1.5u de margem para o traço de 3u)
// Arco vai de -180° a 0° (semicírculo superior)
// ============================================================
const VIEW_W = 36;
const VIEW_H = 20;
const CX = VIEW_W / 2;
const CY = 18;
const R = 15.5;
const START_ANGLE = -180;
const END_ANGLE = 0;
const TOTAL_ANGLE = END_ANGLE - START_ANGLE;
const STROKE = 3;

/**
 * Gauge semicircular de risco (0–100). Cores e labels vêm de
 * `lib/risk.ts` (fonte única). Acessível via `role="img"` +
 * `aria-label` com score e banda.
 *
 * No modo `segmented`, um gap de ~0.9% entre segmentos cria
 * separação visível (evita confusão amarelo/laranja/vermelho).
 */
export default function ScoreGauge({
  score,
  size = 90,
  variant = "full",
  style = "segmented",
  className = "",
}: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = bandOf(clamped);
  const meta = BAND_META[band];
  const isCompact = variant === "compact";

  const pointAt = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  };

  const scoreAngle = START_ANGLE + (clamped / 100) * TOTAL_ANGLE;
  const indicatorPoint = pointAt(scoreAngle);

  const fullArcD = `M ${pointAt(START_ANGLE).x} ${pointAt(START_ANGLE).y} A ${R} ${R} 0 0 1 ${
    pointAt(END_ANGLE).x
  } ${pointAt(END_ANGLE).y}`;

  // 5 segmentos = 5 bandas. gapPct cria separação visível entre eles.
  const segments = [
    { from: 0, to: 20, color: BAND_META.minimal.hex },
    { from: 20, to: 40, color: BAND_META.low.hex },
    { from: 40, to: 60, color: BAND_META.moderate.hex },
    { from: 60, to: 80, color: BAND_META.high.hex },
    { from: 80, to: 100, color: BAND_META.critical.hex },
  ];

  const GAP_PCT = 0.9;
  const segmentArcs = segments.map((seg, i) => {
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    const fromPct = isFirst ? seg.from : seg.from + GAP_PCT;
    const toPct = isLast ? seg.to : seg.to - GAP_PCT;
    const a1 = START_ANGLE + (fromPct / 100) * TOTAL_ANGLE;
    const a2 = START_ANGLE + (toPct / 100) * TOTAL_ANGLE;
    const p1 = pointAt(a1);
    const p2 = pointAt(a2);
    return {
      d: `M ${p1.x} ${p1.y} A ${R} ${R} 0 0 1 ${p2.x} ${p2.y}`,
      color: seg.color,
    };
  });

  const progressArcD = (() => {
    if (clamped <= 0) return "";
    const start = pointAt(START_ANGLE);
    const end = pointAt(scoreAngle);
    const largeArc = clamped > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  })();

  // Alturas derivadas do aspect ratio da viewBox (36:20)
  const svgH = size * (VIEW_H / VIEW_W);

  return (
    <div
      role="img"
      aria-label={`Risco ${clamped} de 100 — ${meta.label}`}
      title={`${clamped}/100 — ${meta.label}\n${meta.executive}`}
      className={`relative inline-flex ${className}`}
      style={{ width: size, height: svgH }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={size}
        height={svgH}
        style={{ display: "block" }}
      >
        {/* Track cinza por baixo — arredonda as extremidades e preenche
            os gaps entre segmentos. */}
        <path
          d={fullArcD}
          fill="none"
          stroke="#374151"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {style === "segmented"
          ? segmentArcs.map((arc, i) => (
              <path
                key={i}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
              />
            ))
          : progressArcD && (
              <path
                d={progressArcD}
                fill="none"
                stroke={meta.hex}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            )}

        {/* Indicador — mantido nos 2 modos */}
        <circle
          cx={indicatorPoint.x}
          cy={indicatorPoint.y}
          r="1.5"
          fill="#ffffff"
          stroke="#0d1117"
          strokeWidth="0.5"
        />
      </svg>

      {/* Texto — ancorado ao fundo do SVG, com altura reservada
          suficiente para o número não ser cortado em `compact`. */}
      <div
        className="absolute inset-x-0 flex flex-col items-center justify-end pointer-events-none"
        style={{
          bottom: svgH * 0.06,
          height: isCompact ? svgH * 0.55 : svgH * 0.7,
        }}
      >
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: size * 0.26, color: meta.hex }}
        >
          {clamped}
        </span>
        {!isCompact && (
          <span
            className="text-gray-300 leading-none"
            style={{ fontSize: Math.max(9, size * 0.11), marginTop: 3 }}
          >
            {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}
