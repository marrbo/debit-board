// types/IStats.ts

export interface DailyStats {
  label: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  open: number;
  recurring: number;
  resolved: number;
  wontFix: number;
  expired: number;
}

export interface StatsCategory {
  label: string;
  value: number;
}

export interface StatsProject {
  label: string;
  value: number;
  status?: Record<string, number>;
  severity?: Record<string, number>;
}

export interface StatsKpi {
  total: number;
  open: number;
  recurring: number;
  resolved: number;
  wontFix: number;
  accepted: number;
  expired: number;
}

export interface StatsData {
  kpi: StatsKpi;
  severityTotals: Record<string, number>;
  categoryTotals: StatsCategory[];
  /** 🔥 Contagem de padrões distintos por categoria. */
  categoryGroupTotals?: Record<string, number>;
  projectTotals: StatsProject[];
  chartData: DailyStats[];
}

/** Resposta de `/api/dashboard/stats`. */
export interface DashboardTeamStats {
  total: number;
  statusTotals: Record<string, number>;
  severityTotals: Record<string, number>;
  categoryTotals: Record<string, number>;
  categoryGroupTotals?: Record<string, number>;
}

export interface DashboardProjectStat {
  total: number;
  severity: Record<string, number>;
  status: Record<string, number>;
  category: Record<string, number>;
}

export interface DashboardStatsResponse {
  teamStats: DashboardTeamStats;
  projectStats: Record<string, DashboardProjectStat>;
  categoryDetails?: Record<string, Record<string, number>>;
}
