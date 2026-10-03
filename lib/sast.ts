// lib/sast.ts
// Formatadores e constantes de apresentação para SAST.
// Compartilhado entre a listagem (`app/sast/page.tsx`) e o drawer
// (`components/SASTScanDrawer.tsx`).

import type { RiskBand } from "@/lib/risk";

// ============================================================
// Formatadores
// ============================================================
export function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

export function formatDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function shortScanId(id: string): string {
  return `DB-SCAN-${id.slice(-6).toUpperCase()}`;
}

export function shortPatternId(id: string): string {
  return `DB-PAT-${id.slice(-6).toUpperCase()}`;
}

// ============================================================
// Origem
// ============================================================
export type ScanOrigin =
  | "azure-search-code"
  | "sonarqube"
  | "trivy"
  | "dependency-track"
  | "snyk";

export const ORIGIN_LABEL: Record<ScanOrigin, string> = {
  "azure-search-code": "Azure Search",
  sonarqube: "SonarQube",
  trivy: "Trivy",
  "dependency-track": "DependencyTrack",
  snyk: "Snyk",
};

export const ORIGIN_STYLE: Record<ScanOrigin, string> = {
  "azure-search-code": "border-blue-500/40 text-blue-400 bg-blue-500/10",
  sonarqube: "border-purple-500/40 text-purple-400 bg-purple-500/10",
  trivy: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  "dependency-track": "border-amber-500/40 text-amber-400 bg-amber-500/10",
  snyk: "border-pink-500/40 text-pink-400 bg-pink-500/10",
};

// ============================================================
// Status do scan
// ============================================================
export type ScanStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export const STATUS_LABEL: Record<ScanStatus, string> = {
  completed: "Concluído",
  running: "Executando",
  failed: "Falha",
  pending: "Pendente",
  cancelled: "Cancelado",
};

export const STATUS_CLASS: Record<ScanStatus, string> = {
  completed: "text-emerald-400",
  running: "text-blue-400 animate-pulse",
  failed: "text-red-400",
  pending: "text-amber-400",
  cancelled: "text-gray-400",
};

// ============================================================
// Severidade
// ============================================================
export type PatternSeverity = "low" | "medium" | "high" | "critical";

export const SEVERITY_LABEL: Record<PatternSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_STYLE: Record<PatternSeverity, string> = {
  low: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
};

// ============================================================
// RiskBand → cor do texto (para uso em KPIs)
// ============================================================
export function riskBandText(band: RiskBand): string {
  return {
    minimal: "text-emerald-400",
    low: "text-green-400",
    moderate: "text-amber-400",
    high: "text-orange-400",
    critical: "text-red-400",
  }[band];
}
