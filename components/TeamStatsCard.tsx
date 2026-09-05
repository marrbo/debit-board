import React from 'react';
import { CheckCircle2, ShieldCheck, SquareOff, BadgePlus, Eye } from 'lucide-react';

interface TeamStatsCardProps {
  type: 'status' | 'category';
  title: string;
  total: number;
  severity?: Record<string, number>;
  status?: Record<string, number>;
  category?: Record<string, number>;
}

// Cores para Severidade (Topo)
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

// Cores para Categoria (Card 2)
const CATEGORY_COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#a78bfa', '#e5e7eb'];

//      open: '#007AFF',
//     recurring: '#FF9500',
//     resolved: '#10b981',
//     wont_fix: '#FF3B30'

// Mapeamento dos Status para o layout do Debit-Board
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open:       { label: 'Novo',         icon: BadgePlus,    color: '#007AFF', bg: '#dbeafe' },
  resolved:   { label: 'Corrigido',    icon: CheckCircle2, color: '#10b981', bg: '#d1fae5' },
  recurring:  { label: 'Recorrente',   icon: ShieldCheck,  color: '#ef4444', bg: '#fee2e2' },
  wont_fix:   { label: 'Não Corrigir', icon: SquareOff,    color: '#000000', bg: '#f3f4f6' },
};

export default function TeamStatsCard({ type, title, total, severity, status, category }: TeamStatsCardProps) {
  // ===================== CARD DE CATEGORIA =====================
  if (type === 'category') {
    const entries = Object.entries(category || {});
    
    const renderStackedBar = () => {
      if (entries.length === 0) return <div className="h-3 w-full bg-gray-200 rounded-full" />;
      return (
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-200">
          {entries.map(([key, value], index) => {
            const width = total > 0 ? (value / total) * 100 : 0;
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return <div key={key} style={{ width: `${width}%`, backgroundColor: color }} />;
          })}
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{total}</span>
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">Observations</span>
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
  
  const severityBar = () => {
    if (severityEntries.length === 0) return <div className="h-3 w-full bg-gray-200 rounded-full" />;
    return (
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-200">
        {severityEntries.map(([key, value]) => {
          const width = total > 0 ? (value / total) * 100 : 0;
          return <div key={key} style={{ width: `${width}%`, backgroundColor: SEVERITY_COLORS[key] || '#e5e7eb' }} />;
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
        {/* <div className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark">last 7 days</div> */}
      </div>
    );
  };

  return (
    <div className="bg-white pb-0 dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
      
      {/* Barra de Severidade */}
      <div className="mt-4">{severityBar()}</div>
      
      {/* Total e Legenda de Severidade */}
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{total}</span>
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">Observations</span>
        </div>
        <div className="flex items-center gap-4">
          {severityLegend()}
        </div>
      </div>

      {/* Grid de Status */}
      <div className="mt-6 grid grid-cols-4 border-t border-gray-200 dark:border-apple-border-dark">
        {renderStatusItem('open')}
        {renderStatusItem('resolved')}
        {renderStatusItem('recurring')}
        {renderStatusItem('wont_fix')}
      </div>
    </div>
  );
}