import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, SquareOff, BadgePlus, Eye } from 'lucide-react';

interface TeamStatsCardProps {
  type: 'status' | 'category';
  title: string;
  total: number;
  severity?: Record<string, number>;
  status?: Record<string, number>;
  category?: Record<string, number>;
  categoryGroup?: Record<string, number>; // 🔥 Novo prop
}

// Cores para Severidade (Topo)
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

// Cores para Categoria (Card 2)
const CATEGORY_COLORS = [
  '#911eb4', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#e6194B', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939',
  '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39',
  '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b'
];

// Mapeamento dos Status para o layout do Debit-Board
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open:       { label: 'Novo',         icon: BadgePlus,    color: '#007AFF', bg: '#dbeafe' },
  resolved:   { label: 'Corrigido',    icon: CheckCircle2, color: '#10b981', bg: '#d1fae5' },
  recurring:  { label: 'Recorrente',   icon: ShieldCheck,  color: '#ef4444', bg: '#fee2e2' },
  wont_fix:   { label: 'Não Corrigir', icon: SquareOff,    color: '#000000', bg: '#f3f4f6' },
};

export default function TeamStatsCard({ type, title, total, severity, status, category, categoryGroup }: TeamStatsCardProps) {
  // 🔥 Estado para alternância (inicia em Grouped)
  const [viewMode, setViewMode] = useState<'grouped' | 'single'>('grouped');

  // ===================== CARD DE CATEGORIA =====================
  if (type === 'category') {
    // Seleciona o mapa baseado no modo
    const categoryMap = viewMode === 'grouped' ? (categoryGroup || {}) : (category || {});
    const entries = Object.entries(categoryMap).sort();
    
    // Total baseado no mapa ativo
    const totalItems = entries.reduce((sum, [, value]) => sum + value, 0);

    const renderToggle = () => (
      <div className="flex rounded-full bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setViewMode('grouped')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
            viewMode === 'grouped'
              ? 'bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          Grouped
        </button>
        <button
          onClick={() => setViewMode('single')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
            viewMode === 'single'
              ? 'bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          Single
        </button>
      </div>
    );

    // 🔹 Barra de Categoria (Grouped/Single)
    const renderStackedBar = () => {
      if (entries.length === 0) return <div className="h-3 w-full bg-apple-card-light dark:bg-apple-card-dark rounded-full" />;
      return (
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-apple-card-light dark:bg-apple-card-dark gap-1">
          {entries.map(([key, value], index) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div
                key={key}
                style={{ flexGrow: value, backgroundColor: color, filter: "saturate(60%)" }}
              />
            );
          })}
        </div>
      );
    };



    return (
      <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
          {renderToggle()}
        </div>
        
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{totalItems}</span>
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
            {viewMode === 'grouped' ? 'Grouped ' : 'Single '}Observations
          </span>
        </div>
        
        <div className="mt-4">{renderStackedBar()}</div>
        
        <div className="mt-4 space-y-2 flex justify-between flex-wrap">
          {entries.length === 0 ? (
            <div className="text-sm text-apple-tertiary-light">Sem dados para exibir</div>
          ) : (
            entries.map(([key, value], index) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                <span className="flex-1 text-sm truncate">{key}</span>
                <span className="font-semibold text-sm">{value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ===================== CARD DE SEVERIDADE E STATUS =====================
  const severityEntries = Object.entries(severity || {});
  
  // 🔹 Barra de Severidade
  const severityBar = () => {
    if (severityEntries.length === 0) return <div className="h-3 w-full bg-apple-card-light dark:bg-apple-card-dark rounded-full" />;
    return (
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-apple-card-light dark:bg-apple-card-dark gap-1">
        {severityEntries.map(([key, value]) => {
          const color = SEVERITY_COLORS[key] || '#e5e7eb';
          return (
            <div
              key={key}
              style={{ flexGrow: value, backgroundColor: color }}
            />
          );
        })}
      </div>
    );
  };

  const severityLegend = () => {
    return severityEntries.map(([key, value]) => (
      <div key={key} className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[key] || '#e5e7eb' }} />
        <span className="text-sm font-semibold">{value}</span>
      </div>
    ));
  };

  const renderStatusItem = (statusKey: string) => {
    const config = STATUS_CONFIG[statusKey] || { label: statusKey, icon: Eye, color: '#9ca3af', bg: '#f3f4f6' };
    const Icon = config.icon;
    const count = status?.[statusKey] || 0;

    return (
      <div className="flex flex-col items-start p-4 border-r last:border-r-0 border-gray-200 dark:border-apple-border-dark">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 flex items-center justify-center rounded-md" style={{ backgroundColor: config.bg }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </span>
          <span className="text-sm font-medium text-apple-label-light dark:text-apple-label-dark">{config.label}</span>
        </div>
        <div className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark">{count}</div>
      </div>
    );
  };

  return (
    <div className="bg-white pb-0 dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
      
      <div className="mt-4">{severityBar()}</div>
      
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{total}</span>
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">Single Observations</span>
        </div>
        <div className="flex items-center gap-4">
          {severityLegend()}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 border-t border-gray-200 dark:border-apple-border-dark">
        {renderStatusItem('open')}
        {renderStatusItem('resolved')}
        {renderStatusItem('recurring')}
        {renderStatusItem('wont_fix')}
      </div>
    </div>
  );
}