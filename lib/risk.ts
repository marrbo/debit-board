// lib/risk.ts

export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskStatus =
  | "open"
  | "resolved"
  | "recurring"
  | "wont_fix"
  | "expired";
export type RiskBand = "minimal" | "low" | "moderate" | "high" | "critical";

export interface RiskFinding {
  severity: RiskSeverity;
  status: RiskStatus;
  hitCount: number;
  firstSeen?: Date | string;
  slaDueAt?: Date | string;
  /** 0–10. Quando presente, substitui a base por severidade. */
  score?: number | null;
}

export interface RiskAggregate {
  /** 0–100, arredondado. */
  score: number;
  band: RiskBand;
  findings: number;
  bySeverity: Record<RiskSeverity, number>;
  topFindingRisk: number;
}

// ============================================================
// Constantes calibradas
// ============================================================
const SEVERITY_BASE: Record<RiskSeverity, number> = {
  critical: 8.0,
  high: 6.0,
  medium: 4.0,
  low: 2.0,
};

const STATUS_MULT: Record<RiskStatus, number> = {
  open: 1.0,
  recurring: 1.15,
  wont_fix: 0.7,
  expired: 0.5,
  resolved: 0.0,
};

const DENSITY_WEIGHT: Record<RiskSeverity, number> = {
  critical: 1.0,
  high: 0.7,
  medium: 0.3,
  low: 0.05,
};

// ============================================================
// Fatores
// ============================================================
function exposureFactor(hitCount: number): number {
  return 1 + Math.min(1, Math.log10(1 + Math.max(0, hitCount)) / 2);
}

function slaPressure(
  firstSeen?: Date | string,
  slaDueAt?: Date | string,
): number {
  if (!firstSeen || !slaDueAt) return 1.0;
  const start = new Date(firstSeen).getTime();
  const due = new Date(slaDueAt).getTime();
  if (!isFinite(start) || !isFinite(due) || due <= start) return 1.0;
  const ratio = (Date.now() - start) / (due - start);
  if (ratio >= 1) return 1.3;
  if (ratio >= 0.8) return 1.15;
  return 1.0;
}

// ============================================================
// Finding
// ============================================================
export function findingRisk(f: RiskFinding): number {
  if (f.status === "resolved") return 0;
  const base = f.score ?? SEVERITY_BASE[f.severity];
  const risk =
    base *
    exposureFactor(f.hitCount) *
    STATUS_MULT[f.status] *
    slaPressure(f.firstSeen, f.slaDueAt);
  return Math.min(10, Math.max(0, risk));
}

// ============================================================
// Agregação
// ============================================================
/**
 * 4 faixas efetivas em 0–100:
 *   0        → "minimal"  (sem exposição ativa; caso especial)
 *   1–39     → "low"
 *   40–59    → "moderate"
 *   60–79    → "high"
 *   80–100   → "critical"
 *
 * `minimal` existe apenas em score 0 para sinalizar "nenhum risco ativo".
 * Visualmente ele compartilha cor com `low`.
 */
export function bandOf(score: number): RiskBand {
  if (score <= 0) return "minimal";
  if (score < 40) return "low";
  if (score < 60) return "moderate";
  if (score < 80) return "high";
  return "critical";
}

export function aggregateRisk(findings: RiskFinding[]): RiskAggregate {
  const active = findings.filter((f) => f.status !== "resolved");

  const bySeverity: Record<RiskSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of active) bySeverity[f.severity] += 1;

  if (active.length === 0) {
    return {
      score: 0,
      band: "minimal",
      findings: 0,
      bySeverity,
      topFindingRisk: 0,
    };
  }

  const risks = active.map(findingRisk);
  const maxR = Math.max(...risks);
  const avgR = risks.reduce((a, b) => a + b, 0) / risks.length;

  let significant = 0;
  for (const f of active) significant += DENSITY_WEIGHT[f.severity];
  const densityComp = Math.min(100, Math.log10(1 + significant) * 40);

  const score = Math.min(
    100,
    0.4 * (maxR * 10) + 0.35 * (avgR * 10) + 0.25 * densityComp,
  );

  return {
    score: Math.round(score),
    band: bandOf(score),
    findings: active.length,
    bySeverity,
    topFindingRisk: Math.round(maxR * 10) / 10,
  };
}

// ============================================================
// Metadados para UI
// ============================================================
export interface BandMeta {
  label: string;
  executive: string;
  specialist: string;
  hex: string;
  text: string;
  bg: string;
  border: string;
}

/**
 * Paleta de 4 cores efetivas. `minimal` e `low` compartilham o mesmo hex
 * (emerald-500) porque representam o mesmo estado visual ("nada ativo" /
 * "poucos riscos"). As demais faixas têm cores perceptivelmente distintas:
 * amber → orange → red.
 *
 * As classes Tailwind (`text-*`, `bg-*`, `border-*`) ficam alinhadas com
 * a família de cada hex — útil para badges/ícones que reaproveitam BAND_META.
 */
export const BAND_META: Record<RiskBand, BandMeta> = {
  minimal: {
    label: "Mínimo",
    executive: "Postura sólida. Nada crítico ou alto pendente.",
    specialist: "Nenhuma exposição crítica ou alta ativa.",
    hex: "#10b981", // emerald-500
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  low: {
    label: "Baixo",
    executive: "Poucos riscos relevantes, sob controle.",
    specialist: "Riscos residuais; nenhuma ação imediata.",
    hex: "#10b981", // emerald-500 (mesma família do minimal)
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  moderate: {
    label: "Moderado",
    executive: "Requer atenção. Há itens abertos relevantes.",
    specialist: "Findings de severidade média/alta demandam plano.",
    hex: "#f59e0b", // amber-500
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  high: {
    label: "Alto",
    executive: "Ação prioritária. Riscos significativos expostos.",
    specialist: "Exposição relevante; SLA tende a estourar.",
    hex: "#f97316", // orange-500
    text: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  critical: {
    label: "Crítico",
    executive: "Intervenção urgente. Riscos severos expostos.",
    specialist: "Exposição severa e/ou volume crítico acumulado.",
    hex: "#ef4444", // red-500
    text: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
};
