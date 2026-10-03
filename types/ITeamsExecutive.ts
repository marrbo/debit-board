// types/ITeamsExecutive.ts
import type { RiskAggregate } from "@/lib/risk";

export type ExecutiveScope = "global" | "team";

// ============================================================
// Fluxo (com range aplicado)
// ============================================================
export interface TeamSeverityTotals {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved: number;
  recurring: number;
  wontFix: number;
  expired: number;
}

export interface TeamCategoryRow {
  category: string;
  observations: number;
  patterns: number;
}

export interface TeamPatternRow {
  patternId: string;
  patternName: string;
  category: string;
  observations: number;
}

// ============================================================
// Estado atual (atemporal)
// ============================================================
export interface CurrentStateTotals {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
  atRisk: number;
  onTrack: number;
}

export interface CurrentStateAging {
  days0To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
}

export interface CurrentStateProjectRow {
  project: string;
  teamName: string;
  risk: RiskAggregate;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
}

export interface TeamCurrentState {
  risk: RiskAggregate;
  totals: CurrentStateTotals;
  aging: CurrentStateAging;
  projects: CurrentStateProjectRow[];
}

// ============================================================
// Entrada por time
// ============================================================
export interface TeamExecutiveEntry {
  teamId: string;
  teamName: string;
  /** Fluxo — respeita o range. */
  totals: TeamSeverityTotals;
  /** Estado atual — atemporal. */
  currentState: TeamCurrentState;
  categories: TeamCategoryRow[];
  patterns: TeamPatternRow[];
}

// ============================================================
// Resposta
// ============================================================
export interface TeamsExecutiveResponse {
  generatedAt: string;
  scope: ExecutiveScope;
  teams: TeamExecutiveEntry[];
  aggregated: {
    totals: TeamSeverityTotals;
    currentState: TeamCurrentState;
    categories: TeamCategoryRow[];
    patterns: TeamPatternRow[];
  };
}

// Re-export para conveniência
export type { RiskAggregate };
