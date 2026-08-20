'use client';

import { useState, useEffect } from 'react';
import KPICards from '@/components/KPICards';
import Charts from '@/components/Charts';
import { ChartDataPoint } from '@/lib/types';

export default function Dashboard() {
  const [data, setData] = useState<{
    dailyData: Record<string, number>;
    totalRecords: number;
    totalHits: number;
    uniqueGerencia: number;
    issuesStats: {
      open: number;
      recurring: number;
      fixed: number;
      overdue: number;
      wont_fix: number;
    };
  }>({
    dailyData: {},
    totalRecords: 0,
    totalHits: 0,
    uniqueGerencia: 0,
    issuesStats: { open: 0, recurring: 0, fixed: 0, wont_fix: 0, overdue: 0 },
  });
  const [period, setPeriod] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === 'custom' && startDate && endDate) {
        params.set('start', startDate);
        params.set('end', endDate);
      } else { params.set('period', period); }
      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const chartLabels = Object.keys(data.dailyData).sort();
  const chartValues = chartLabels.map(d => data.dailyData[d]);
  const chartData: ChartDataPoint[] = chartLabels.map((l, i) => ({ label: l, value: chartValues[i] }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Visão Geral</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-slate-200 transition-colors">
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === 'custom' && (
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-slate-200 transition-colors" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-slate-200 transition-colors" />
              <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">Filtrar</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-gray-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin"></div></div>
      ) : (
        <>
          {/* KPIs Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Total Registros</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalRecords}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Hits Totais</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.totalHits}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Gerências</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.uniqueGerencia}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Observations</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.issuesStats.open + data.issuesStats.recurring}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl p-4 text-center shadow-sm transition-colors">
              <p className="text-xs text-red-600 dark:text-red-400 uppercase font-bold">Em atraso</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.issuesStats.overdue || 0}</p>
            </div>
          </div>

          {/* KPIs de Issues (Sonar/Sentry Style) */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl p-4 text-center shadow-sm transition-colors">
              <p className="text-xs text-red-600 dark:text-red-400 uppercase font-bold">Abertas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.issuesStats.open}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 text-center shadow-sm transition-colors">
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-bold">Recorrentes</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.issuesStats.recurring}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-4 text-center shadow-sm transition-colors">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold">Corrigidas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.issuesStats.fixed}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-600/40 rounded-xl p-4 text-center shadow-sm transition-colors">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase font-bold">Não Corrigir</p>
              <p className="text-2xl font-bold text-gray-500 dark:text-slate-400">{data.issuesStats.wont_fix}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Evolução de Ocorrências</h3>
              <div className="h-64">
                <Charts data={chartData} type="line" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm transition-colors">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Distribuição por Gerência</h3>
              <div className="h-64">
                <p className="text-gray-500 dark:text-slate-400 text-center pt-10">Em breve</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}