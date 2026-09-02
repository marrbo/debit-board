'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Charts from '@/components/Charts';
import PageHeader from '@/components/PageHeader';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';
import { BarChart3, X, Maximize2, XCircle, ExternalLink } from 'lucide-react';
import type { IObservation } from '@/models/Observation';
import { PaginationInfo } from '@/components/PaginationInfo';
import AssigneeSelect from '@/components/AssigneeSelect';
import ObservationDrawer from '@/components/ObservationDrawer';
import type { StatsData, DailyStats } from './services/statsService';
import type { IUser } from '@/models/User';

// Componente ChartCard movido para fora (evita criação durante render)
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
    <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">{title}</h3>
        <button
          onClick={() => onExpand(chartKey)}
          className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors"
          title="Expandir gráfico"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

interface StatsClientProps {
  initialStats: StatsData;
  initialObservations: IObservation[];
  initialTotal: number;
  initialTotalPages: number;
  initialPage: number;
  initialPageSize: number;
}

export default function StatsClient({
  initialStats,
  initialObservations,
  initialTotal,
  initialTotalPages,
  initialPage,
  initialPageSize,
}: StatsClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Estados principais
  const [stats, setStats] = useState<StatsData>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastCategory, setLastCategory] = useState<string | null>(null);
  const [projectViewMode, setProjectViewMode] = useState<'status' | 'severity'>('status');
  const [evolutionViewMode, setEvolutionViewMode] = useState<'severity' | 'status'>('severity');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // Estados da tabela de observações
  const [obsPage, setObsPage] = useState(initialPage);
  const [obsPageSize, setObsPageSize] = useState(initialPageSize);
  const [observations, setObservations] = useState<IObservation[]>(initialObservations);
  const [obsTotal, setObsTotal] = useState(initialTotal);
  const [obsTotalPages, setObsTotalPages] = useState(initialTotalPages);
  const [loadingObs, setLoadingObs] = useState(false);

  // Usuários e observação selecionada
  const [users, setUsers] = useState<IUser[]>([]);
  const [selectedObservation, setSelectedObservation] = useState<IObservation | null>(null);

  // Refs
  const lastSearchQueryRef = useRef<string>('');
  const originalQueryRef = useRef<string>('');

  // Função para mapear severidade para cor
  const severityColors: Record<string, string> = {
    critical: '#FF3B30',
    high: '#FF9500',
    medium: '#FFCC00',
    low: '#007AFF',
  };

  // ================= FETCH STATS =================
  const fetchStats = useCallback(async (query: string): Promise<StatsData> => {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    const res = await fetch(`/api/stats?${params.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar estatísticas');
    return await res.json() as StatsData;
  }, []);

  // ================= FETCH OBSERVATIONS =================
  const fetchObservations = useCallback(async (
    query: string,
    page: number,
    limit: number
  ): Promise<{ observations: IObservation[]; total: number; totalPages: number }> => {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    const res = await fetch(`/api/observations?${params.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar observações');
    return await res.json();
  }, []);

  // ================= BUSCAR USUÁRIOS =================
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    let cancelled = false;

    fetch('/api/users')
      .then(res => res.ok ? res.json() : Promise.reject('Erro ao carregar usuários'))
      .then((data: IUser[]) => {
        if (!cancelled) setUsers(data);
      })
      .catch(err => {
        console.error('Erro ao carregar usuários:', err);
      });

    return () => { cancelled = true; };
  }, [session, status]);

  // ================= CARREGAR DADOS PRINCIPAIS (STATS + OBSERVAÇÕES) =================
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    let cancelled = false;

    const loadAll = async () => {
      // Agendar loading para evitar setState síncrono no corpo do efeito
      Promise.resolve().then(() => {
        if (!cancelled) {
          setLoading(true);
          setLoadingObs(true);
        }
      });

      try {
        const [statsData, obsData] = await Promise.all([
          fetchStats(searchQuery),
          fetchObservations(searchQuery, obsPage, obsPageSize),
        ]);

        if (!cancelled) {
          setStats(statsData);
          setError(null);
          setObservations(obsData.observations || []);
          setObsTotal(obsData.total || 0);
          setObsTotalPages(obsData.totalPages || 1);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        }
      } finally {
        // Agendar loading final
        Promise.resolve().then(() => {
          if (!cancelled) {
            setLoading(false);
            setLoadingObs(false);
          }
        });
      }
    };

    loadAll();

    return () => { cancelled = true; };
  }, [searchQuery, obsPage, obsPageSize, fetchStats, fetchObservations, status, session]);

  // ================= HANDLER DE BUSCA =================
  const handleSearch = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
    lastSearchQueryRef.current = newQuery;
    setObsPage(1);
  }, []);

  // ================= ATUALIZAR RESPONSÁVEL =================
  const updateAssignee = async (issueId: string, assignedTo: string | null) => {
    setObservations((prev) =>
      prev.map((obs) =>
        obs._id.toString() === issueId ? { ...obs, assignedTo: assignedTo || undefined } as IObservation : obs
      )
    );
    setSelectedObservation((prev) =>
      prev && prev._id.toString() === issueId ? { ...prev, assignedTo: assignedTo || undefined } as IObservation : prev
    );

    try {
      const res = await fetch('/api/observations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, assignedTo: assignedTo || null }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
    } catch (err) {
      alert(err.message);
      // Recarregar observações com o limit correto
      try {
        const obsData = await fetchObservations(searchQuery, obsPage, obsPageSize);
        setObservations(obsData.observations || []);
        setObsTotal(obsData.total || 0);
        setObsTotalPages(obsData.totalPages || 1);
      } catch (reloadErr) {
        console.error('Erro ao recarregar observações:', reloadErr);
      }
    }
  };

  // ================= DADOS DERIVADOS =================
  const severityTotals = stats?.severityTotals || {};
  const categoryTotals = stats?.categoryTotals || [];
  const projectTotals = useMemo(() => stats?.projectTotals || [], [stats?.projectTotals]);

  const chartData = useMemo(
    () => stats?.chartData?.filter((d: DailyStats) => d.total > 0) || [],
    [stats?.chartData]
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

    const labels = chartData.map((d: DailyStats) => format(new Date(d.label), 'dd MMM', { locale: ptBR }));
    const total = chartData.map((d: DailyStats) => d.total);
    const medianTotal = movingAverage(total);

    const datasets: unknown[] = [];

    if (evolutionViewMode === 'severity') {
      const severities = [
        { key: 'critical', label: 'Crítico', color: '#FF3B30' },
        { key: 'high', label: 'Alto', color: '#FF9500' },
        { key: 'medium', label: 'Médio', color: '#FFCC00' },
        { key: 'low', label: 'Baixo', color: '#007AFF' },
      ] as const;

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
      const statuses = [
        { key: 'open', label: 'Aberta', color: '#007AFF' },
        { key: 'recurring', label: 'Recorrente', color: '#FF9500' },
        { key: 'resolved', label: 'Resolvida', color: '#34C759' },
        { key: 'wontFix', label: 'Não Corrigir', color: '#FF3B30' },
      ] as const;

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

  // ================= HANDLERS DE CATEGORIA =================
  const handleSliceClick = (label: string) => {
    const cleanLabel = label.replace(/"/g, '');

    if (lastCategory) clearCategoryFilter();

    originalQueryRef.current = searchQuery;

    const currentQuery = searchQuery;
    let newQuery: string;
    if (currentQuery.trim()) {
      newQuery = `(${currentQuery}) AND category:"${cleanLabel}"`;
    } else {
      newQuery = `category:"${cleanLabel}"`;
    }

    setSearchQuery(newQuery);
    setLastCategory(cleanLabel);
    lastSearchQueryRef.current = newQuery;
  };

  const clearCategoryFilter = () => {
    if (!lastCategory) return;

    const original = originalQueryRef.current;
    setSearchQuery(original);
    setLastCategory(null);
    originalQueryRef.current = '';
    lastSearchQueryRef.current = original;
  };

  // ================= RENDERIZAÇÃO =================
  if (status === 'loading') {
    return <div className="text-apple-tertiary-light py-10 text-center">Carregando...</div>;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (loading && !stats) {
    return <div className="text-center py-12"><div className="w-8 h-8 border-4 border-apple-border-light dark:border-apple-border-dark border-t-[#007AFF] rounded-full animate-spin mx-auto"></div></div>;
  }

  if (error) {
    return <div className="bg-[#FFD1D1] dark:bg-[#FF453A]/20 border border-[#FF453A]/40 rounded-xl p-6 text-[#FF453A]">{error}</div>;
  }

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Stats & Usage"
        icon={<BarChart3 className="w-10 h-10 text-apple-blue" />}
        subtitle="Visão geral das observations de segurança do seu Tenant."
        searchBar={
          <div className="relative">
            <DBQLAdvancedSearch 
              onSearch={handleSearch} 
              userId={session.user.id || ''} 
              placeholder="Search stats, e.g. severity:critical OR project:my-api" 
              context="observations"
            />
            {lastCategory && (
              <button onClick={clearCategoryFilter} className="absolute -top-2 -right-2 bg-white dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-full p-1 shadow-md text-apple-tertiary-light hover:text-apple-red transition-colors" title="Limpar filtro de categoria">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      />

      {/* KPIs de Status (somente exibição, sem filtro) */}
      <div className="grid grid-cols-2 md:grid-cols-5 text-center gap-4">
        {[
          { key: 'total', label: 'Ocorrências', value: stats!.kpi.total, color: 'text-apple-label-light' },
          { key: 'open', label: 'Abertas', value: stats!.kpi.accepted, color: 'text-apple-blue' },
          { key: 'recurring', label: 'Recorrentes', value: stats!.kpi.recurring, color: 'text-apple-orange' },
          { key: 'resolved', label: 'Resolvidas', value: stats!.kpi.resolved, color: 'text-apple-green' },
          { key: 'wontFix', label: 'Não Corrigir', value: stats!.kpi.wontFix, color: 'text-apple-tertiary-light' },
        ].map((card) => (
          <div
            key={card.key}
            className={`bg-apple-card-light dark:bg-apple-card-dark border rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-all border-apple-border-light dark:border-apple-border-dark`}
          >
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light tracking-wider">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Cards de Severidade (somente exibição, sem filtro) */}
      <div className="grid grid-cols-2 md:grid-cols-4 text-center gap-4">
        {[
          { key: 'critical', label: 'Crítico', value: severityTotals.critical || 0, color: 'border-apple-red' },
          { key: 'high', label: 'Alto', value: severityTotals.high || 0, color: 'border-apple-orange' },
          { key: 'medium', label: 'Médio', value: severityTotals.medium || 0, color: 'border-apple-yellow' },
          { key: 'low', label: 'Baixo', value: severityTotals.low || 0, color: 'border-apple-blue' },
        ].map((card) => (
          <div
            key={card.key}
            className={`bg-apple-card-light dark:bg-apple-card-dark border border-l-4 ${card.color} rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-all`}
          >
            <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{card.value}</p>
            <p className="text-[10px] uppercase font-bold text-apple-tertiary-light">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução */}
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Evolução: Novas ocorrências</h3>
            <button onClick={() => setExpandedChart('evolution')} className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors" title="Expandir gráfico">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end mb-3">
            <div className="relative flex items-center bg-apple-border-light/30 dark:bg-[#2C2C2E] rounded-full p-1 w-40">
              <div className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white dark:bg-[#48484A] shadow-sm transition-all duration-300`} style={{ left: evolutionViewMode === 'severity' ? '0.25rem' : 'calc(50% + 0.25rem)' }} />
              <button onClick={() => setEvolutionViewMode('severity')} className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${evolutionViewMode === 'severity' ? 'text-apple-blue' : 'text-apple-tertiary-light'}`}>Severidade</button>
              <button onClick={() => setEvolutionViewMode('status')} className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${evolutionViewMode === 'status' ? 'text-apple-orange' : 'text-apple-tertiary-light'}`}>Status</button>
            </div>
          </div>
          <div className="h-64">
            <Charts datasets={evolutionData.datasets} labels={evolutionData.labels} type="line" />
          </div>
        </div>

        {/* Categoria */}
        <ChartCard title="Distribuição por Categoria" chartKey="category" onExpand={setExpandedChart}>
          {categoryTotals.length > 0 ? (
            <Charts data={categoryTotals} type="pie" onSliceClick={handleSliceClick} />
          ) : (
            <div className="flex items-center justify-center h-full text-apple-tertiary-light text-sm">Nenhuma categoria encontrada.</div>
          )}
          {lastCategory && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-apple-tertiary-light">Filtro: <span className="font-mono text-apple-blue">category:`{lastCategory}`</span></p>
              <button onClick={clearCategoryFilter} className="flex items-center gap-1 text-[11px] text-apple-red hover:underline"><XCircle className="w-3 h-3" /> Voltar</button>
            </div>
          )}
        </ChartCard>

        {/* Projetos */}
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors relative">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Total por Projeto (TOP 10)</h3>
            <button onClick={() => setExpandedChart('project')} className="p-1.5 text-apple-tertiary-light hover:text-apple-blue transition-colors" title="Expandir gráfico"><Maximize2 className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-end mb-3">
            <div className="relative flex items-center bg-apple-border-light/30 dark:bg-[#2C2C2E] rounded-full p-1 w-40">
              <div className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white dark:bg-[#48484A] shadow-sm transition-all duration-300`} style={{ left: projectViewMode === 'status' ? '0.25rem' : 'calc(50% + 0.25rem)' }} />
              <button onClick={() => setProjectViewMode('status')} className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${projectViewMode === 'status' ? 'text-apple-blue' : 'text-apple-tertiary-light'}`}>Status</button>
              <button onClick={() => setProjectViewMode('severity')} className={`relative z-10 flex-1 text-[11px] font-medium py-1 rounded-full transition-colors ${projectViewMode === 'severity' ? 'text-apple-orange' : 'text-apple-tertiary-light'}`}>Severidade</button>
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
        <div className="fixed inset-0 -space-y-6 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-apple-border-light dark:border-apple-border-dark">
              <h3 className="text-base font-semibold text-apple-label-light dark:text-apple-label-dark">
                {expandedChart === 'evolution' ? 'Evolução de Ocorrências' : expandedChart === 'category' ? 'Distribuição por Categoria' : 'Total por Projeto (TOP 10)'}
              </h3>
              <button onClick={() => setExpandedChart(null)} className="p-2 text-apple-tertiary-light hover:text-apple-red transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              {expandedChart === 'evolution' && <Charts datasets={evolutionData.datasets} labels={evolutionData.labels} type="line" />}
              {expandedChart === 'category' && <Charts data={categoryTotals} type="pie" onSliceClick={handleSliceClick} />}
              {expandedChart === 'project' && <Charts datasets={projectStackedData.datasets} labels={projectStackedData.labels} type="stacked-bar" />}
            </div>
          </div>
        </div>
      )}

      {/* ================= TABELA DE OBSERVAÇÕES ================= */}
      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-apple-border-light dark:border-apple-border-dark">
          <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Observações ({obsTotal})</h3>
        </div>

        <PaginationInfo
          currentPage={obsPage}
          totalPages={obsTotalPages}
          totalItems={obsTotal}
          pageSize={obsPageSize}
          onPageChange={setObsPage}
          onPageSizeChange={setObsPageSize}
          className="border-b border-apple-border-light dark:border-apple-border-dark"
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-apple-border-light/20 dark:bg-apple-border-dark/20 sticky top-0 z-10">
              <tr>
                <th style={{ width: '8%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Severidade</th>
                <th style={{ width: '8%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Status</th>
                <th style={{ width: '32%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Arquivo / Observação</th>
                <th style={{ width: '22%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Categoria</th>
                <th style={{ width: '8%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Branch</th>
                <th style={{ width: '10%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">SLA</th>
                <th style={{ width: '12%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Responsável</th>
                <th style={{ width: '8%' }} className="px-3 py-2 text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
              {loadingObs ? (
                <tr><td colSpan={7} className="p-8 text-center">Carregando observações...</td></tr>
              ) : observations.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-apple-tertiary-light text-sm">Nenhuma observação encontrada.</td></tr>
              ) : (
                observations.map((issue) => (
                  <tr
                    key={issue._id.toString()}
                    className="observation-row cursor-pointer"
                    style={{
                      '--severity-color': severityColors[issue.severity] || '#8E8E93',
                    } as React.CSSProperties}
                    onClick={() => setSelectedObservation(issue)}
                  >
                    {/* Severidade */}
                    <td className="px-4 py-3 text-center overflow-hidden">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>{issue.severity}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center overflow-hidden">
                      <span className={`inline-block px-2 py-0.5 min-w-20 text-[10px] font-bold uppercase rounded ${
                        issue.status === 'recurring' ? 'bg-orange-100 text-orange-800' :
                        issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>{issue.status}</span>
                    </td>
                    
                    {/* Arquivo / Observação */}
                    <td className="px-4 py-3 overflow-hidden">
                      <div className="flex flex-col gap-0.5 w-full">
                        <span className="text-xs font-semibold truncate block w-full whitespace-nowrap">{issue.fileName}</span>
                        <span className="text-[10px] font-mono text-apple-tertiary-light truncate block w-full whitespace-nowrap">{issue.filePath}</span>
                        <span className="text-[10px] font-medium text-apple-tertiary-light block w-full">{issue.hitCount} {issue.hitCount === 1 ? 'hit' : 'hits'}</span>
                      </div>
                    </td>

                    {/* Categoria */}
                    <td className="px-4 py-3 text-xs text-center overflow-hidden">
                      <div className="truncate whitespace-nowrap">{issue.category}</div>
                    </td>

                    {/* Branch */}
                    <td className="px-4 py-3 text-xs text-center font-mono overflow-hidden">
                      <div className="truncate whitespace-nowrap">{issue.branch}</div>
                    </td>

                    {/* SLA */}
                    <td className="px-4 py-3 text-xs text-center  overflow-hidden">
                      <div className="truncate whitespace-nowrap">{issue.slaDueAt ? new Date(issue.slaDueAt).toLocaleDateString('pt-BR') : '—'}</div>
                    </td>

                    {/* Responsável */}
                    <td className="px-4 py-3 text-center overflow-hidden">
                      <AssigneeSelect users={users} value={issue.assignedTo} onChange={(v) => updateAssignee(issue._id.toString(), v)} className="text-center" />
                    </td>

                    {/* Ação */}
                    <td className="px-4 py-3 text-center overflow-hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedObservation(issue); }}
                        className="p-2 rounded-lg hover:bg-apple-border-light/30 text-apple-tertiary-light hover:text-apple-blue transition-colors"
                        aria-label="Ver detalhes"
                        title="Ver detalhes"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationInfo
          currentPage={obsPage}
          totalPages={obsTotalPages}
          totalItems={obsTotal}
          pageSize={obsPageSize}
          onPageChange={setObsPage}
          onPageSizeChange={setObsPageSize}
          className="border-t border-apple-border-light dark:border-apple-border-dark"
        />
      </div>

      {/* Drawer de detalhes */}
      <ObservationDrawer
        observation={selectedObservation}
        users={users}
        onClose={() => setSelectedObservation(null)}
        onUpdateAssignee={updateAssignee}
      />
    </div>
  );
}