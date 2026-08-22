// app/stats/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { subDays } from 'date-fns';
import Charts from '@/components/Charts';
import PageHeader from '@/components/PageHeader';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';
import { BarChart3, X, Maximize2, XCircle } from 'lucide-react';

/**
 * Interface que define a estrutura de cada ponto diário retornado pela API /api/stats.
 */
interface DailyStats {
  label: string;        // data no formato yyyy-MM-dd
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

/**
 * Interface que define a estrutura dos dados completos retornados pela API.
 */
interface StatsData {
  kpi: {
    total: number;
    accepted: number;
    resolved: number;
    recurring: number;
    wontFix: number;
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

/**
 * Página de Estatísticas (Stats & Usage)
 * - Exibe KPIs, severidade, categorias e projetos.
 * - Gráfico de evolução com alternância por severidade ou status.
 * - Gráfico de projetos com barras empilhadas por status/severidade.
 * - Clique em categoria adiciona filtro DBQL com botão de limpar.
 * - Cada gráfico possui botão de expandir.
 */
export default function StatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ================= ESTADO =================
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [externalQuery, setExternalQuery] = useState('');
  const [lastCategory, setLastCategory] = useState<string | null>(null);
  const [projectViewMode, setProjectViewMode] = useState<'status' | 'severity'>('status');
  const [evolutionViewMode, setEvolutionViewMode] = useState<'severity' | 'status'>('severity');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // ================= FETCH DE DADOS =================
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar estatísticas');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    fetchData();
  }, [searchQuery, session, status]);

  useEffect(() => {
    if (externalQuery !== undefined) {
      setSearchQuery(externalQuery);
    }
  }, [externalQuery]);

  // ================= DADOS DA EVOLUÇÃO =================
  const chartData = stats?.chartData || [];

  /**
   * Calcula a média móvel de uma série de valores.
   * @param values - Array de números.
   * @param windowSize - Tamanho da janela (padrão 3).
   * @returns Array com a média móvel.
   */
  const movingAverage = (values: number[], windowSize = 3): number[] => {
    if (!values.length) return [];
    return values.map((_, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
      return Math.round(avg * 100) / 100;
    });
  };

  /**
   * Monta os datasets do gráfico de evolução com base no modo selecionado.
   * - Modo 'severity': linhas por severidade + mediana total.
   * - Modo 'status': linhas por status + mediana total.
   */
  const evolutionData = useMemo(() => {
    if (!chartData.length) return { labels: [], datasets: [] };

    const labels = chartData.map((d: DailyStats) => format(new Date(d.label), 'dd MMM', { locale: ptBR }));
    const total = chartData.map((d: DailyStats) => d.total);
    const medianTotal = movingAverage(total);

    const datasets: any[] = [];

    if (evolutionViewMode === 'severity') {
      // Dados por severidade (reais)
      const severities = [
        { key: 'critical', label: 'Crítico', color: '#FF3B30' },
        { key: 'high', label: 'Alto', color: '#FF9500' },
        { key: 'medium', label: 'Médio', color: '#FFCC00' },
        { key: 'low', label: 'Baixo', color: '#007AFF' },
      ];

      severities.forEach(({ key, label, color }) => {
        datasets.push({
          label,
          data: chartData.map((d: DailyStats) => d[key]),
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          tension: 0.3,
          fill: false,
        });
      });
    } else {
      // Dados por status (reais)
      const statuses = [
        { key: 'open', label: 'Open', color: '#007AFF' },
        { key: 'recurring', label: 'Recorrente', color: '#FF9500' },
        { key: 'resolved', label: 'Resolvido', color: '#34C759' },
        { key: 'wontFix', label: 'Wont Fix', color: '#FF3B30' },
      ];

      statuses.forEach(({ key, label, color }) => {
        datasets.push({
          label,
          data: chartData.map((d: DailyStats) => d[key]),
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          tension: 0.3,
          fill: false,
        });
      });
    }

    // Adiciona a mediana total (única linha tracejada)
    datasets.push({
      label: 'Mediana (Total)',
      data: medianTotal,
      borderColor: '#8E8E93',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    });

    return { labels, datasets };
  }, [chartData, evolutionViewMode]);

  // ================= DADOS DO GRÁFICO DE PROJETOS =================
  const severityTotals = stats?.severityTotals || {};
  const categoryTotals = stats?.categoryTotals || [];
  const projectTotals = stats?.projectTotals || [];

  const projectStackedData = useMemo(() => {
    if (!projectTotals.length) return { labels: [], datasets: [] };

    const labels = projectTotals.map((p) => p.label);

    if (projectViewMode === 'status') {
      const statuses = ['open', 'resolved', 'recurring', 'wont_fix', 'unknown'] as const;
      const colors: Record<string, string> = {
        open: '#007AFF',
        resolved: '#34C759',
        recurring: '#FF9500',
        wont_fix: '#FF3B30',
        unknown: '#8E8E93',
      };

      const datasets = statuses
        .filter((status) => projectTotals.some((p) => (p.status?.[status] || 0) > 0))
        .map((status) => ({
          label: status.replace('_', ' '),
          data: projectTotals.map((p) => p.status?.[status] || 0),
          backgroundColor: colors[status],
          stack: 'stack0',
        }));

      return { labels, datasets };
    } else {
      const severities = ['critical', 'high', 'medium', 'low', 'unknown'] as const;
      const colors: Record<string, string> = {
        critical: '#FF3B30',
        high: '#FF9500',
        medium: '#FFCC00',
        low: '#007AFF',
        unknown: '#8E8E93',
      };

      const datasets = severities
        .filter((sev) => projectTotals.some((p) => (p.severity?.[sev] || 0) > 0))
        .map((sev) => ({
          label: sev,
          data: projectTotals.map((p) => p.severity?.[sev] || 0),
          backgroundColor: colors[sev],
          stack: 'stack0',
        }));

      return { labels, datasets };
    }
  }, [projectTotals, projectViewMode]);

  // ================= HANDLERS =================
  const handleSliceClick = (label: string) => {
    const cleanLabel = label.replace(/"/g, '');
    const currentQuery = searchQuery || '';
    const newQuery = currentQuery
      ? `${currentQuery} AND category:"${cleanLabel}"`
      : `category:"${cleanLabel}"`;
    setExternalQuery(newQuery);
    setLastCategory(cleanLabel);
  };

  const clearCategoryFilter = () => {
    if (!lastCategory) return;
    const queryWithoutCategory = externalQuery
      .replace(/\s*AND\s+category:"[^"]*"/i, '')
      .replace(/^category:"[^"]*"/i, '');
    setExternalQuery(queryWithoutCategory.trim());
    setLastCategory(null);
  };

  // ================= RENDERIZAÇÃO =================
  if (status === 'loading') return <div className="text-apple-tertiary-light py-10 text-center">Carregando...</div>;
  if (!session) router.push('/login');

  if (loading) return <div className="text-center py-12"><div className="w-8 h-8 border-4 border-apple-border-light dark:border-apple-border-dark border-t-[#007AFF] rounded-full animate-spin mx-auto"></div></div>;
  if (error) return <div className="bg-[#FFD1D1] dark:bg-[#FF453A]/20 border border-[#FF453A]/40 rounded-xl p-6 text-[#FF453A]">{error}</div>;

  const ChartCard = ({ title, children, chartKey }: { title: string; children: React.ReactNode; chartKey: string }) => (
    <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">{title}</h3>
        <button
          onClick={() => setExpandedChart(chartKey)}
          className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors"
          title="Expandir gráfico"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Stats & Usage"
        icon={<BarChart3 size="36px" />}
        subtitle="Visão geral das issues de segurança do seu Tenant."
        searchBar={
          <div className="relative">
            <DBQLAdvancedSearch
              onSearch={setSearchQuery}
              userId={session?.user.id || ''}
              placeholder="Search stats, e.g. severity:critical OR project:my-api"
              context="issues"
              externalQuery={externalQuery}
              onExternalQueryChange={(q) => setExternalQuery(q)}
            />
            {lastCategory && (
              <button
                onClick={clearCategoryFilter}
                className="absolute -top-2 -right-2 bg-white dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-full p-1 shadow-md text-apple-tertiary-light hover:text-apple-red transition-colors"
                title="Limpar filtro de categoria"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light tracking-wider">Total Issues</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{stats!.kpi.total}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-blue tracking-wider">Em andamento</p>
          <p className="text-2xl font-bold text-apple-blue mt-1">{stats!.kpi.accepted}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-green tracking-wider">Corrigidas</p>
          <p className="text-2xl font-bold text-apple-green mt-1">{stats!.kpi.resolved}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-orange tracking-wider">Recorrentes</p>
          <p className="text-2xl font-bold text-apple-orange mt-1">{stats!.kpi.recurring}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light tracking-wider">Não Corrigir</p>
          <p className="text-2xl font-bold text-apple-tertiary-light mt-1">{stats!.kpi.wontFix}</p>
        </div>
      </div>

      {/* Severidade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none border-l-4 border-[#FF3B30] transition-colors">
          <p className="text-[10px] uppercase font-bold text-apple-red">Crítico</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{severityTotals.critical || 0}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none border-l-4 border-[#FF9500] transition-colors">
          <p className="text-[10px] uppercase font-bold text-apple-orange">Alto</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{severityTotals.high || 0}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none border-l-4 border-[#FFCC00] transition-colors">
          <p className="text-[10px] uppercase font-bold text-apple-yellow">Médio</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{severityTotals.medium || 0}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none border-l-4 border-apple-blue transition-colors">
          <p className="text-[10px] uppercase font-bold text-apple-blue">Baixo</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{severityTotals.low || 0}</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução com slider */}
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Evolução de Ocorrências</h3>
            <button
              onClick={() => setExpandedChart('evolution')}
              className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors"
              title="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          {/* Slider para alternar entre Severidade e Status */}
          <div className="flex items-center justify-end mb-3">
            <div className="relative flex items-center bg-apple-border-light/30 dark:bg-[#2C2C2E] rounded-full p-1 w-40">
              <div
                className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white dark:bg-[#48484A] shadow-sm transition-all duration-300`}
                style={{ left: evolutionViewMode === 'severity' ? '0.25rem' : 'calc(50% + 0.25rem)' }}
              />
              <button
                onClick={() => setEvolutionViewMode('severity')}
                className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${
                  evolutionViewMode === 'severity' ? 'text-apple-blue' : 'text-apple-tertiary-light'
                }`}
              >
                Severidade
              </button>
              <button
                onClick={() => setEvolutionViewMode('status')}
                className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${
                  evolutionViewMode === 'status' ? 'text-apple-orange' : 'text-apple-tertiary-light'
                }`}
              >
                Status
              </button>
            </div>
          </div>
          <div className="h-64">
            <Charts datasets={evolutionData.datasets} labels={evolutionData.labels} type="line" />
          </div>
        </div>

        {/* Categoria */}
        <ChartCard title="Distribuição por Categoria" chartKey="category">
          {categoryTotals.length > 0 ? (
            <Charts data={categoryTotals} type="pie" onSliceClick={handleSliceClick} />
          ) : (
            <div className="flex items-center justify-center h-full text-apple-tertiary-light text-sm">Nenhuma categoria encontrada.</div>
          )}
          {lastCategory && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-apple-tertiary-light">
                Filtro: <span className="font-mono text-apple-blue">category:"{lastCategory}"</span>
              </p>
              <button
                onClick={clearCategoryFilter}
                className="flex items-center gap-1 text-[11px] text-apple-red hover:underline"
              >
                <XCircle className="w-3 h-3" /> Voltar
              </button>
            </div>
          )}
        </ChartCard>

        {/* Projetos com barras empilhadas */}
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Total por Projeto (TOP 10)</h3>
            <button
              onClick={() => setExpandedChart('project')}
              className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors"
              title="Expandir gráfico"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end mb-3">
            <div className="relative flex items-center bg-apple-border-light/30 dark:bg-[#2C2C2E] rounded-full p-1 w-40">
              <div
                className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white dark:bg-[#48484A] shadow-sm transition-all duration-300`}
                style={{ left: projectViewMode === 'status' ? '0.25rem' : 'calc(50% + 0.25rem)' }}
              />
              <button
                onClick={() => setProjectViewMode('status')}
                className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${
                  projectViewMode === 'status' ? 'text-apple-blue' : 'text-apple-tertiary-light'
                }`}
              >
                Status
              </button>
              <button
                onClick={() => setProjectViewMode('severity')}
                className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${
                  projectViewMode === 'severity' ? 'text-apple-orange' : 'text-apple-tertiary-light'
                }`}
              >
                Severidade
              </button>
            </div>
          </div>
          <div className="h-64">
            {projectStackedData.datasets.length > 0 ? (
              <Charts datasets={projectStackedData.datasets} labels={projectStackedData.labels} type="stacked-bar" />
            ) : (
              <div className="flex items-center justify-center h-full text-apple-tertiary-light text-sm">Nenhum projeto encontrado.</div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL DE EXPANSÃO ================= */}
      {expandedChart && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-apple-border-light dark:border-apple-border-dark">
              <h3 className="text-base font-semibold text-apple-label-light dark:text-apple-label-dark">
                {expandedChart === 'evolution' ? 'Evolução de Ocorrências' : expandedChart === 'category' ? 'Distribuição por Categoria' : 'Total por Projeto (TOP 10)'}
              </h3>
              <button
                onClick={() => setExpandedChart(null)}
                className="p-2 text-apple-tertiary-light hover:text-apple-red transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              {expandedChart === 'evolution' && (
                <Charts datasets={evolutionData.datasets} labels={evolutionData.labels} type="line" />
              )}
              {expandedChart === 'category' && (
                <Charts data={categoryTotals} type="pie" onSliceClick={handleSliceClick} />
              )}
              {expandedChart === 'project' && (
                <Charts datasets={projectStackedData.datasets} labels={projectStackedData.labels} type="stacked-bar" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}