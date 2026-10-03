// components/RiskBadge.tsx
"use client";

import { BAND_META, bandOf } from "@/lib/risk";

interface RiskBadgeProps {
  score: number;
  /** Mostra a banda textual ao lado do número. Default `true`. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Badge compacto de risco para uso em tabelas e cards.
 * Ex.: `[ 72 Alto ]`.
 */
export default function RiskBadge({
  score,
  showLabel = true,
  className = "",
}: RiskBadgeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const meta = BAND_META[bandOf(clamped)];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.bg} ${meta.border} ${meta.text} ${className}`}
      title={`${clamped}/100 — ${meta.label}\n${meta.executive}`}
    >
      <span className="tabular-nums">{clamped}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
