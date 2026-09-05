import { serverFetch } from '@/lib/serverFetch';

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
  kpi: { total: number; accepted: number; resolved: number; recurring: number; wontFix: number; expired: number };
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

export async function getStats(searchQuery?: string): Promise<StatsData> {
  const params = new URLSearchParams();
  if (searchQuery) params.set('search', searchQuery);

  const data = await serverFetch<StatsData>(`/api/stats?${params.toString()}`, {
    cache: 'no-store',
  });
  return data;
}