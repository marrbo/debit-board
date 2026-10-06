"use client";

import { BAND_META, bandOf } from "@/lib/risk";

type ScoreGaugeStyle = "segmented" | "progress";
type ScoreGaugeTheme = "auto" | "light" | "dark";

interface ScoreGaugeProps {
  /** 0–100. */
  score: number;
  /** Diâmetro externo em px. Default 90. */
  size?: number;
  /**
   * `full` (default): número + label da banda.
   * `compact`: só o número.
   */
  variant?: "full" | "compact";
  /**
   * `segmented` (default): 4 segmentos coloridos, espectro completo.
   * `progress`: arco monocromático na cor da banda atual.
   */
  style?: ScoreGaugeStyle;
  /**
   * Força o tema local do gauge, independente do contexto pai.
   * - `auto` (default): herda o tema do ancestral (Dashboard, etc.).
   * - `light` / `dark`: aplica `data-theme` + classe `dark` no wrapper,
   *   fazendo os tokens CSS (`--text-heading`, `--bg-elevated`, ...)
   *   resolverem para a paleta alvo. Útil dentro de Drawers que são
   *   sempre dark mesmo quando o app está em light.
   */
  theme?: ScoreGaugeTheme;
  className?: string;
}

// ============================================================
// Geometria — fixa em viewBox units
// viewBox: 36 × 20 | cx = 18 | cy = 18 | r = 15.5
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

export default function ScoreGauge({
  score,
  size = 90,
  variant = "full",
  style = "segmented",
  theme = "auto",
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

  const startP = pointAt(START_ANGLE);
  const endP = pointAt(END_ANGLE);
  const fullArcD = `M ${startP.x} ${startP.y} A ${R} ${R} 0 0 1 ${endP.x} ${endP.y}`;

  // ============================================================
  // Segmentos visuais — 4 faixas (minimal e low compartilham cor)
  //   0–40   → verde  (low)
  //   40–60  → âmbar  (moderate)
  //   60–80  → laranja(high)
  //   80–100 → vermelho(critical)
  // ============================================================
  const segments = [
    { from: 0, to: 40, color: BAND_META.low.hex },
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

  // Arco de progresso. Como o gauge é um semicírculo, qualquer sub-arco
  // tem ≤ 180°, então `largeArc` é sempre 0.
  const progressArcD = (() => {
    if (clamped <= 0) return "";
    return `M ${startP.x} ${startP.y} A ${R} ${R} 0 0 1 ${indicatorPoint.x} ${indicatorPoint.y}`;
  })();

  // Altura visual do componente (aspect ratio 36:20)
  const svgH = size * (VIEW_H / VIEW_W);

  // Tema local — quando forçado, emite data-theme + classe `dark`
  // para que os tokens CSS da subárvore resolvam para a paleta alvo.
  const themeAttrs =
    theme === "auto"
      ? {}
      : {
          "data-theme": theme,
          ...(theme === "dark" ? { className: "dark" } : {}),
        };

  return (
    <div
      {...themeAttrs}
      role="img"
      aria-label={`Risco ${clamped} de 100 — ${meta.label}`}
      title={`${clamped}/100 — ${meta.label}\n${meta.executive}`}
      className={`relative inline-flex ${className} ${
        theme === "dark" ? "dark" : ""
      }`}
      style={{ width: size, height: svgH }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={size}
        height={svgH}
        style={{ display: "block" }}
      >
        {/* Track de fundo — token adaptativo ao tema */}
        <path
          d={fullArcD}
          fill="none"
          stroke="var(--border-strong)"
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

        {/* Indicador — anel adaptativo ao tema local */}
        <circle
          cx={indicatorPoint.x}
          cy={indicatorPoint.y}
          r="1.5"
          fill="var(--bg-elevated)"
          stroke="var(--text-heading)"
          strokeWidth="0.5"
        />
      </svg>

      {/* Texto — ancorado por `top`; transbordo leve no rodapé é
          intencional (respira melhor que colar nos cotos do arco). */}
      <div
        className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
        style={{ top: svgH * 0.3 }}
      >
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: size * 0.32, color: "var(--text-heading)" }}
        >
          {clamped}
        </span>
        {!isCompact && (
          <span
            className="leading-none"
            style={{
              fontSize: Math.max(9, size * 0.11),
              marginTop: size * 0.02,
              color: "var(--text-muted)",
            }}
          >
            {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}
