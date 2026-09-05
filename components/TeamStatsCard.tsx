import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, ShieldCheck, SquareOff, BadgePlus, Eye } from 'lucide-react';

interface TeamStatsCardProps {
  type: 'status' | 'category';
  title: string;
  total: number;
  severity?: Record<string, number>;
  status?: Record<string, number>;
  category?: Record<string, number>;
  categoryGroup?: Record<string, number>;
  categoryDetails?: Record<string, Record<string, number>>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

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

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open:       { label: 'Novo',         icon: BadgePlus,    color: '#007AFF', bg: '#dbeafe' },
  resolved:   { label: 'Corrigido',    icon: CheckCircle2, color: '#10b981', bg: '#d1fae5' },
  recurring:  { label: 'Recorrente',   icon: ShieldCheck,  color: '#ef4444', bg: '#fee2e2' },
  wont_fix:   { label: 'Não Corrigir', icon: SquareOff,    color: '#000000', bg: '#f3f4f6' },
};

export default function TeamStatsCard({ type, title, total, severity, status, category, categoryGroup, categoryDetails }: TeamStatsCardProps) {
  const [viewMode, setViewMode] = useState<'grouped' | 'single'>('grouped');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'center' | 'right' | 'left'>('center');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setActiveCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Clique abre/fecha o popup
  // Função de clique que recebe o evento e calcula a posição correta
  const handleClick = (key: string, event: React.MouseEvent) => {
    setActiveCategory(prev => (prev === key ? null : key));
    
    // Obtém a posição do item clicado
    const rect = event.currentTarget.getBoundingClientRect();
    const popupWidth = 384; // w-96
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (spaceRight < popupWidth) {
      setDropdownPosition('right'); // alinha à direita do item
    } else if (spaceLeft < popupWidth) {
      setDropdownPosition('left'); // alinha à esquerda do item
    } else {
      setDropdownPosition('center'); // centraliza
    }
  };

  if (type === 'category') {
    const categoryMap = viewMode === 'grouped' ? (categoryGroup || {}) : (category || {});
    const entries = Object.entries(categoryMap).sort();
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
          Grupo
        </button>
        <button
          onClick={() => setViewMode('single')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
            viewMode === 'single'
              ? 'bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
          }`}
        >
          Individual
        </button>
      </div>
    );

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
                onClick={() => handleClick(key)}
                className="cursor-pointer"
              />
            );
          })}
        </div>
      );
    };

    const renderLegend = () => {
      if (entries.length === 0) return <div className="text-sm text-apple-tertiary-light">Sem dados para exibir</div>;
      return (
        <div className="mt-4 space-y-2 flex justify-between flex-wrap">
          {entries.map(([key, value], index) => (
            <div
              key={key}
              ref={itemRef}
              className={`relative flex items-center gap-2 cursor-pointer transition-colors ${
                activeCategory === key
                  ? 'text-apple-blue underline'
                  : 'hover:text-apple-blue hover:underline'
              }`}
              onClick={(e) => handleClick(key, e)}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
              <span className="flex-1 text-sm truncate">{key}</span>
              <span className="font-semibold text-sm">{value}</span>

              {/* CARD estilo dropdown com posição dinâmica */}
              {activeCategory === key && categoryDetails?.[key] && Object.keys(categoryDetails[key]).length > 0 && (
                <div className={`absolute bottom-full mb-3 w-96 bg-white dark:bg-apple-bg-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-lg z-50 overflow-hidden ${
                  dropdownPosition === 'right' ? 'right-0' :
                  dropdownPosition === 'left' ? 'left-0' :
                  'left-1/2 -translate-x-1/2'
                }`}>
                  <div className="px-4 py-3 border-b border-apple-border-light dark:border-apple-border-dark">
                    <h4 className="text-sm font-bold text-apple-label-light dark:text-apple-label-dark">{key}</h4>
                    <p className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark">{value} {viewMode === 'grouped' ? 'grupos' : 'observações'}</p>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {Object.entries(categoryDetails[key])
                      .sort((a, b) => b[1] - a[1])
                      .map(([pattern, count], i) => (
                        <div key={pattern} className={`flex items-center justify-between px-4 py-2 text-sm ${i % 2 === 0 ? 'bg-apple-bg-light/80 dark:bg-apple-card-dark/70' : ''}`}>
                          <span className="truncate pr-2 text-apple-tertiary-light dark:text-apple-secondary-dark">{pattern}</span>
                          <span className="font-semibold text-apple-label-light dark:text-apple-label-dark">{count}</span>
                        </div>
                      ))}
                  </div>

                  <div className="px-4 py-2 border-t border-apple-border-light dark:border-apple-border-dark flex justify-between items-center bg-apple-bg-light/30 dark:bg-apple-card-dark/10">
                    <span className="text-xs font-bold uppercase text-apple-tertiary-light dark:text-apple-tertiary-dark">Total</span>
                    <span className="text-sm font-bold text-apple-label-light dark:text-apple-label-dark">
                      {Object.values(categoryDetails[key]).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div ref={cardRef} className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
          {renderToggle()}
        </div>
        
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{totalItems}</span>
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
            Observações{viewMode === 'grouped' ? ' agrupadas' : ' individuais'}
          </span>
        </div>
        
        <div className="mt-4">{renderStackedBar()}</div>
        {renderLegend()}
      </div>
    );
  }

  const severityEntries = Object.entries(severity || {});
  
  const severityBar = () => {
    if (severityEntries.length === 0) return <div className="h-3 w-full bg-apple-card-light dark:bg-apple-card-dark rounded-full" />;
    return (
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-apple-card-light dark:bg-apple-card-dark gap-1">
        {severityEntries.map(([key, value]) => {
          const color = SEVERITY_COLORS[key] || '#e5e7eb';
          return <div key={key} style={{ flexGrow: value, backgroundColor: color }} />;
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
          <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">Observações</span>
        </div>
        <div className="flex items-center gap-4">{severityLegend()}</div>
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