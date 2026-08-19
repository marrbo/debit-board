// app/stats/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Charts from '@/components/Charts';
import PageHeader from '@/components/PageHeader';
import AdvancedSearch from '@/components/AdvancedSearch';
import { ChartDataPoint } from '@/lib/types';

export default function StatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar estatísticas');
      const data = await res.json();
      setStats(data);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    fetchData();
  }, [searchQuery, session, status]);

  if (status === 'loading') return <div className="text-apple-tertiary-light py-10 text-center">Carregando...</div>;
  if (!session) router.push('/login');

  if (loading) return <div className="text-center py-12"><div className="w-8 h-8 border-4 border-apple-border-light dark:border-apple-border-dark border-t-[#007AFF] rounded-full animate-spin mx-auto"></div></div>;
  if (error) return <div className="bg-[#FFD1D1] dark:bg-[#FF453A]/20 border border-[#FF453A]/40 rounded-xl p-6 text-[#FF453A]">{error}</div>;

  // Processamento do gráfico de linha
  const chartData: ChartDataPoint[] = (stats?.chartData || []).map((d: any) => ({
    label: format(new Date(d.label), 'dd MMM', { locale: ptBR }),
    value: d.value
  }));

  const severityTotals = stats?.severityTotals || {};
  const categoryTotals = stats?.categoryTotals || [];
  const projectTotals = stats?.projectTotals || [];

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Stats & Usage"
        subtitle="Visão geral das issues de segurança do seu Tenant."
        searchBar={
          <AdvancedSearch onSearch={setSearchQuery} placeholder="Search stats, e.g. severity:critical OR project:my-api" context="stats"/>
        }
      />

      {/* 🍎 KPIs Gerais (Estilo Apple) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light tracking-wider">Total Issues</p>
          <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{stats.kpi.total}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-blue tracking-wider">Em andamento</p>
          <p className="text-2xl font-bold text-apple-blue mt-1">{stats.kpi.accepted}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-green tracking-wider">Corrigidas</p>
          <p className="text-2xl font-bold text-apple-green mt-1">{stats.kpi.fixed}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-orange tracking-wider">Recorrentes</p>
          <p className="text-2xl font-bold text-apple-orange mt-1">{stats.kpi.recurring}</p>
        </div>
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light tracking-wider">Não Corrigir</p>
          <p className="text-2xl font-bold text-apple-tertiary-light mt-1">{stats.kpi.wontFix}</p>
        </div>
      </div>

      {/* 🍎 Cards de Severidade (Bordas Coloridas Esquerdas - Legível em ambos os temas) */}
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

      {/* 🍎 Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark mb-3">Evolução de Ocorrências</h3>
          <div className="h-64"><Charts data={chartData} type="line" /></div>
        </div>

        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark mb-3">Distribuição por Categoria</h3>
          <div className="h-64">
            {categoryTotals.length > 0 ? (
              <Charts data={categoryTotals} type="pie" />
            ) : (
              <div className="flex items-center justify-center h-full text-apple-tertiary-light text-sm">
                Nenhuma categoria encontrada.
              </div>
            )}
          </div>
        </div>

        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors">
          <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark mb-3">Total por Projeto (TOP 10)</h3>
          <div className="h-64">
            {projectTotals.length > 0 ? (
              <Charts data={projectTotals} type="bar" />
            ) : (
              <div className="flex items-center justify-center h-full text-apple-tertiary-light text-sm">
                Nenhum projeto encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}