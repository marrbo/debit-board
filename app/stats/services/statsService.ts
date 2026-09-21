// app/stats/services/statsService.ts
import { serverFetch } from "@/lib/serverFetch";

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
}

export interface StatsData {
  kpi: {
    total: number;
    accepted: number;
    resolved: number;
    recurring: number;
    wontFix: number;
    expired: number;
  };
  severityTotals: Record<string, number>;
  categoryTotals: { label: string; value: number }[];
  projectTotals: {
    label: string;
    value: number;
    status?: Record<string, number>;
    severity?: Record<string, number>;
  }[];
  chartData: DailyStats[];
}

const EMPTY_STATS: StatsData = {
  kpi: {
    total: 0,
    accepted: 0,
    resolved: 0,
    recurring: 0,
    wontFix: 0,
    expired: 0,
  },
  severityTotals: {},
  categoryTotals: [],
  projectTotals: [],
  chartData: [],
};

export async function getStats(q?: string): Promise<StatsData> {
  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);

    const data = await serverFetch<StatsData>(
      `/api/stats?${params.toString()}`,
      { cache: "no-store" },
    );

    // Sanity check: se veio vazio/erro, devolve o shape esperado
    if (!data || typeof data !== "object" || !("kpi" in data)) {
      return EMPTY_STATS;
    }
    return data;
  } catch {
    // SSR falhou (sem cookie, 401, etc.) — o cliente vai refazer o fetch
    return EMPTY_STATS;
  }
}
