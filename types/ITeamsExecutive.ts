// types/ITeamsExecutive.ts

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

export interface TeamProjectRow {
  project: string;
  teamName: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TeamExecutiveEntry {
  teamId: string;
  teamName: string;
  totals: TeamSeverityTotals;
  categories: TeamCategoryRow[];
  patterns: TeamPatternRow[];
  projects: TeamProjectRow[];
}

export interface TeamsExecutiveResponse {
  generatedAt: string;
  scope: "global" | "team";
  teams: TeamExecutiveEntry[];
  aggregated: {
    totals: TeamSeverityTotals;
    categories: TeamCategoryRow[];
    patterns: TeamPatternRow[];
    projects: TeamProjectRow[];
  };
}
