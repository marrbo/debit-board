"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Charts from "@/components/Charts";
import { X, Maximize2, XCircle, BarChart3, FilterIcon } from "lucide-react";
import type { StatsData, DailyStats } from "./services/statsService";
import PageHeader from "@/components/PageHeader";
import TeamStatsCard from "@/components/TeamStatsCard";
import TeamSelector from "@/components/TeamSelector";
import { useTeam, useSlideToggle } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";
import SlideToggle from "@/components/SlideToggle";

// ============================================================
// ChartCard
// ============================================================
function ChartCard({
  title,
  children,
  chartKey,
  onExpand,
}: {
  title: string;
  children: ReactNode;
  chartKey: string;
  onExpand: (chartKey: string) => void;
}) {
  return (
    <div className="bg-elevated border border-subtle dark:border-strong rounded-lg p-5 shadow-sm hover:drop-shadow-lg dark:shadow-none transition-colors flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-body dark:text-body shrink-0">
          {title}
        </h3>
        <button
          onClick={() => onExpand(chartKey)}
          className="p-1.5 text-muted hover:text-brand transition-colors"
          title="Expandir gráfico"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      {/* 🔑 Sem h-64: o Charts define a própria altura via prop `height` */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ============================================================
// Props
// ============================================================
interface StatsClientProps {
  initialStats: StatsData;
}

// ============================================================
// Componente
// ============================================================
export default function StatsClient({ initialStats }: StatsClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // 🔥 Time persistido (mesma fonte do Dashboard)
  const [teamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  const [stats, setStats] = useState<StatsData>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastCategory, setLastCategory] = useState<string | null>(null);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  // 🔥 Modos de visualização persistidos por página
  const { value: projectViewMode, setValue: setProjectViewMode } =
    useSlideToggle<"severity" | "status">(
      pathname,
      "projectViewMode",
      "status",
    );

  const { value: evolutionViewMode, setValue: setEvolutionViewMode } =
    useSlideToggle<"severity" | "status">(
      pathname,
      "evolutionViewMode",
      "severity",
    );

  // Refs
  const lastSearchQueryRef = useRef<string>("");
  const originalQueryRef = useRef<string>("");
  const lastSearchValueRef = useRef<string>("");

  // ============================================================
  // Handlers
  // ============================================================
  const handleSearch = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
  }, []);

  const resolveQuery = useCallback(
    async (queryOrId: string): Promise<string> => {
      if (!queryOrId) return "";
      const isObjectId = /^[a-fA-F0-9]{24}$/.test(queryOrId);
      if (!isObjectId) return queryOrId;

      try {
        const res = await fetch(`/api/saved-query?id=${queryOrId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          const query = Array.isArray(json) ? json[0] : json.data?.[0] || json;
          return query?.queryString || "";
        }
        return "";
      } catch {
        return "";
      }
    },
    [],
  );

  const fetchStats = useCallback(
    async (q: string, teamIdParam: string | null): Promise<StatsData> => {
      const params = new URLSearchParams();
      if (q) params.set("q", q); // 🔥 q em vez de search
      if (teamIdParam && teamIdParam !== "all") {
        params.set("teamId", teamIdParam);
      }

      const res = await fetch(`/api/stats?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Erro ao carregar estatísticas");
      return (await res.json()) as StatsData;
    },
    [],
  );

  const clearCategoryFilter = useCallback(() => {
    if (!lastCategory) return;
    const original = originalQueryRef.current;
    lastSearchValueRef.current = original;
    setSearchQuery(original);
    setLastCategory(null);
    originalQueryRef.current = "";
    lastSearchQueryRef.current = original;
  }, [lastCategory]);

  const handleSliceClick = useCallback(
    async (label: string) => {
      const cleanLabel = label.replace(/"/g, "");
      if (lastCategory) clearCategoryFilter();

      originalQueryRef.current = searchQuery;
      const resolved = await resolveQuery(searchQuery);
      const currentQuery = resolved;

      const newQuery = currentQuery.trim()
        ? `(${currentQuery}) AND category:"${cleanLabel}"`
        : `category:"${cleanLabel}"`;

      lastSearchValueRef.current = newQuery;
      setLastCategory(cleanLabel);
      lastSearchQueryRef.current = newQuery;

      handleSearch(newQuery);
    },
    [
      lastCategory,
      searchQuery,
      resolveQuery,
      clearCategoryFilter,
      handleSearch,
    ],
  );

  // ============================================================
  // Fetch de stats — aguarda teams carregados
  // ============================================================
  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    if (!teamsLoaded) return;

    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      try {
        // 🔥 Manda o `searchQuery` cru — o servidor resolve ID → string
        const statsData = await fetchStats(searchQuery, effectiveTeamId);
        if (!cancelled) {
          setStats(statsData);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar dados",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, effectiveTeamId, teamsLoaded, fetchStats, status, session]);

  // ============================================================
  // Derivados
  // ============================================================
  const severityTotals = stats?.severityTotals || {};
  const categoryTotals = stats?.categoryTotals || [];
  const projectTotals = useMemo(
    () => stats?.projectTotals || [],
    [stats?.projectTotals],
  );

  const statusTotals = useMemo(
    () => ({
      open: stats?.kpi?.accepted || 0,
      resolved: stats?.kpi?.resolved || 0,
      recurring: stats?.kpi?.recurring || 0,
      wont_fix: stats?.kpi?.wontFix || 0,
    }),
    [stats],
  );

  const chartData = useMemo(
    () => stats?.chartData?.filter((d: DailyStats) => d.total > 0) || [],
    [stats?.chartData],
  );

  const movingAverage = (values: number[], windowSize = 3): number[] => {
    if (!values.length) return [];
    return values.map((_, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
      return Math.round(avg * 100) / 100;
    });
  };

  const evolutionData = useMemo(() => {
    if (!chartData.length) return { labels: [], datasets: [] };

    const labels = chartData.map((d: DailyStats) =>
      format(new Date(d.label), "dd MMM", { locale: ptBR }),
    );
    const total = chartData.map((d: DailyStats) => d.total);
    const medianTotal = movingAverage(total);

    const datasets: unknown[] = [];

    if (evolutionViewMode === "severity") {
      const severities = [
        { key: "critical", label: "Crítico", color: "#FF3B30" },
        { key: "high", label: "Alto", color: "#FF9500" },
        { key: "medium", label: "Médio", color: "#FFCC00" },
        { key: "low", label: "Baixo", color: "#007AFF" },
      ] as const;

      severities.forEach(({ key, label, color }) => {
        datasets.push({
          label,
          data: chartData.map((d: DailyStats) => d[key]),
          borderColor: color,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          tension: 0.3,
          fill: false,
        });
      });
    } else {
      const statuses = [
        { key: "open", label: "Aberta", color: "#007AFF" },
        { key: "recurring", label: "Recorrente", color: "#FF9500" },
        { key: "resolved", label: "Resolvida", color: "#34C759" },
        { key: "wontFix", label: "Não Corrigir", color: "#FF3B30" },
      ] as const;

      statuses.forEach(({ key, label, color }) => {
        datasets.push({
          label,
          data: chartData.map((d: DailyStats) => d[key]),
          borderColor: color,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          tension: 0.3,
          fill: false,
        });
      });
    }

    datasets.push({
      label: "Mediana (Total)",
      data: medianTotal,
      borderColor: "#8E8E93",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0.3,
      fill: true,
    });

    return { labels, datasets };
  }, [chartData, evolutionViewMode]);

  const projectStackedData = useMemo(() => {
    if (!projectTotals.length) return { labels: [], datasets: [] };

    // 🔥 Ordena por total decrescente e limita a 7 itens (menos é mais)
    const sorted = [...projectTotals]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 7);

    const labels = sorted.map((p) =>
      p.label.length > 18 ? `${p.label.slice(0, 17)}…` : p.label,
    );

    if (projectViewMode === "status") {
      const statuses = [
        { key: "open", label: "Aberta", color: "#3B82F6" },
        { key: "recurring", label: "Recorrente", color: "#F59E0B" },
        { key: "resolved", label: "Resolvida", color: "#10B981" },
        { key: "wont_fix", label: "Não corrigir", color: "#EF4444" },
        { key: "unknown", label: "Outros", color: "#94A3B8" },
      ] as const;

      const datasets = statuses
        .filter((s) => sorted.some((p) => (p.status?.[s.key] || 0) > 0))
        .map((status) => ({
          label: status.label,
          data: sorted.map((p) => p.status?.[status.key] || 0),
          backgroundColor: status.color,
          stack: "stack0",
          borderRadius: 2,
          borderSkipped: false as const,
        }));

      return { labels, datasets };
    }

    const severities = [
      { key: "critical", label: "Crítico", color: "#EF4444" },
      { key: "high", label: "Alto", color: "#F97316" },
      { key: "medium", label: "Médio", color: "#EAB308" },
      { key: "low", label: "Baixo", color: "#3B82F6" },
      { key: "unknown", label: "Outros", color: "#94A3B8" },
    ] as const;

    const datasets = severities
      .filter((s) => sorted.some((p) => (p.severity?.[s.key] || 0) > 0))
      .map((sev) => ({
        label: sev.label,
        data: sorted.map((p) => p.severity?.[sev.key] || 0),
        backgroundColor: sev.color,
        stack: "stack0",
        borderRadius: 2,
        borderSkipped: false as const,
      }));

    return { labels, datasets };
  }, [projectTotals, projectViewMode]);

  // ============================================================
  // Guards
  // ============================================================
  if (status === "loading") {
    return <div className="text-muted py-10 text-center">Carregando...</div>;
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  if (loading && !stats) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-default dark:border-strong border-t-[#007AFF] rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#FFD1D1] dark:bg-[#FF453A]/20 border border-[#FF453A]/40 rounded-lg p-6 text-[#FF453A]">
        {error}
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Stats & Usage"
        icon={<BarChart3 className="w-10 h-10 text-brand" />}
        subtitle="Visão geral das observations de segurança do seu Tenant."
        search={{
          type: "advanced",
          onSearch: handleSearch,
          userSub: session.user.sub,
          placeholder: "Search stats, e.g. severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={
          <div className="flex items-center gap-2">
            {lastCategory && (
              <button
                onClick={clearCategoryFilter}
                className="px-3 py-2 bg-red-600/10 text-error border border-error/20 rounded-lg text-xs font-medium hover:bg-red-600/20 transition-colors"
                title="Limpar filtro de categoria"
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            )}
            <TeamSelector teams={teams} />
          </div>
        }
      />

      {/* Card compartilhado de Severidade e Status */}
      <TeamStatsCard
        type="status"
        variant="compact"
        title="Severidade e Status"
        total={stats!.kpi.total}
        severity={severityTotals}
        status={statusTotals}
      />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução */}
        <div className="bg-elevated border border-subtle dark:border-strong rounded-lg p-5 shadow-sm hover:drop-shadow-lg dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-body dark:text-body shrink-0">
              Novas ocorrências
            </h3>

            <div className="flex items-center gap-2 shrink-0">
              <SlideToggle
                options={[
                  {
                    key: "severity",
                    label: "Severidade",
                    activeClassName: "text-success",
                  },
                  {
                    key: "status",
                    label: "Status",
                    activeClassName: "text-warning",
                  },
                ]}
                value={evolutionViewMode}
                onChange={setEvolutionViewMode}
                width={170}
                height={28}
                className="font-mono"
              />
              <button
                onClick={() => setExpandedChart("evolution")}
                className="p-1.5 text-muted hover:text-brand transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Charts
              datasets={evolutionData.datasets}
              labels={evolutionData.labels}
              type="line"
            />
          </div>
        </div>

        {/* Categoria */}
        <ChartCard
          title="Distribuição por Categoria"
          chartKey="category"
          onExpand={setExpandedChart}
        >
          {categoryTotals.length > 0 ? (
            <div style={{ height: 280 }}>
              <Charts
                data={categoryTotals}
                type="pie"
                onSliceClick={handleSliceClick}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Nenhuma categoria encontrada.
            </div>
          )}
          {lastCategory && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-muted">
                Filtro:{" "}
                <span className="font-mono text-brand">
                  category:`{lastCategory}`
                </span>
              </p>
              <button
                onClick={clearCategoryFilter}
                className="flex items-center gap-1 text-[11px] text-error hover:underline"
              >
                <XCircle className="w-3 h-3" /> Voltar
              </button>
            </div>
          )}
        </ChartCard>

        {/* Projetos */}
        <div className="bg-elevated border border-subtle dark:border-strong rounded-lg p-5 shadow-sm hover:drop-shadow-lg dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-body dark:text-body shrink-0">
              Total por Projeto
            </h3>

            <div className="flex items-center gap-2 shrink-0">
              <SlideToggle
                options={[
                  {
                    key: "severity",
                    label: "Severidade",
                    activeClassName: "text-success",
                  },
                  {
                    key: "status",
                    label: "Status",
                    activeClassName: "text-warning",
                  },
                ]}
                value={projectViewMode}
                onChange={setProjectViewMode}
                width={160}
                height={28}
                className="font-mono"
              />
              <button
                onClick={() => setExpandedChart("project")}
                className="p-1.5 text-muted hover:text-brand transition-colors"
                title="Expandir gráfico"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            {projectStackedData.datasets.length > 0 ? (
              <Charts
                datasets={projectStackedData.datasets}
                labels={projectStackedData.labels}
                type="stacked-bar"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted text-sm">
                Nenhum projeto encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de expansão */}
      {expandedChart && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-default dark:border-strong">
              <h3 className="text-base font-semibold text-heading dark:text-heading">
                {expandedChart === "evolution"
                  ? "Evolução de Ocorrências"
                  : expandedChart === "category"
                    ? "Distribuição por Categoria"
                    : "Total por Projeto (TOP 10)"}
              </h3>
              <button
                onClick={() => setExpandedChart(null)}
                className="p-2 text-muted hover:text-error transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              {expandedChart === "evolution" && (
                <Charts
                  datasets={evolutionData.datasets}
                  labels={evolutionData.labels}
                  type="line"
                />
              )}
              {expandedChart === "category" && (
                <Charts
                  data={categoryTotals}
                  type="pie"
                  onSliceClick={handleSliceClick}
                />
              )}
              {expandedChart === "project" && (
                <Charts
                  datasets={projectStackedData.datasets}
                  labels={projectStackedData.labels}
                  type="stacked-bar"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
