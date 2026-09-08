import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  BadgePlus,
  Eye,
  Maximize2,
  X,
  ShieldX,
  CalendarSync,
  UsersIcon,
  Group,
  FileStack,
  FileCode
} from 'lucide-react';

interface TeamStatsCardProps {
  type: 'status' | 'category';
  title: string;
  total: number;
  severity?: Record<string, number>;
  status?: Record<string, number>;
  category?: Record<string, number>;
  categoryGroup?: Record<string, number>;
  categoryDetails?: Record<string, Record<string, number>>;
  variant?: 'default' | 'compact';
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const SEVERITY_SHIELDS = [
  { key: 'critical', letter: 'C', color: '#ef4444', label: 'Critical' },
  { key: 'high', letter: 'H', color: '#f97316', label: 'High' },
  { key: 'medium', letter: 'M', color: '#eab308', label: 'Medium' },
  { key: 'low', letter: 'L', color: '#22c55e', label: 'Low' },
];

const CATEGORY_COLORS = [
  '#911eb4', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#e6194B',
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
  recurring:  { label: 'Recorrente',   icon: CalendarSync, color: '#ef4444', bg: '#fee2e2' },
  wont_fix:   { label: 'Não Corrigir', icon: ShieldX,      color: '#000000', bg: '#f3f4f6' },
};

export default function TeamStatsCard({ type, title, total, severity, status, category, categoryGroup, categoryDetails, variant = 'default' }: TeamStatsCardProps) {
  const [viewMode, setViewMode] = useState<'grouped' | 'single'>('grouped');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'center' | 'right' | 'left'>('center');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalViewMode, setModalViewMode] = useState<'grouped' | 'single'>('grouped');

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

  const handleClick = (key: string, event: React.MouseEvent) => {
    setActiveCategory(prev => (prev === key ? null : key));
    const rect = event.currentTarget.getBoundingClientRect();
    const popupWidth = 384;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    if (spaceRight < popupWidth) setDropdownPosition('right');
    else if (spaceLeft < popupWidth) setDropdownPosition('left');
    else setDropdownPosition('center');
  };

  // ===================== FUNÇÕES AUXILIARES =====================
  const severityBar = () => {
    const severityEntries = Object.entries(severity || {});
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
    return SEVERITY_SHIELDS.map(({ key, letter, color, label }) => (
      <div key={key} className="flex justify-between items-center gap-2" title={`${label}: ${severity?.[key] || 0}`}>
        <div className="relative w-5 h-6">
          <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-sm">
            <path d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z" fill={color} />
            <path d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[8px]">{letter}</span>
        </div>
        <span className="text-sm font-semibold text-apple-label-light dark:text-apple-label-dark">{severity?.[key] || 0}</span>
      </div>
    ));
  };

  const renderStatusItem = (statusKey: string) => {
    const config = STATUS_CONFIG[statusKey] || { label: statusKey, icon: Eye, color: '#9ca3af', bg: '#f3f4f6' };
    const Icon = config.icon;
    const count = status?.[statusKey] || 0;

    return (
      <div className="flex flex-col items-start justify-center p-4 border-r last:border-r-0 border-gray-200 dark:border-apple-border-dark">
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

  // ===================== CARD DE CATEGORIA =====================
  if (type === 'category') {
    const categoryMap = viewMode === 'grouped' ? (categoryGroup || {}) : (category || {});
    const entries = Object.entries(categoryMap).sort();
    const totalItems = entries.reduce((sum, [, value]) => sum + value, 0);

    // 🔥 Limite de itens visíveis: 5 (para caber no card)
    const MAX_VISIBLE_ITEMS = 5;
    const hasMoreItems = entries.length > MAX_VISIBLE_ITEMS;
    const visibleEntries = hasMoreItems ? entries.slice(0, MAX_VISIBLE_ITEMS) : entries;

    // 🔥 Toggle com efeito slide
    const renderToggle = (mode: 'grouped' | 'single', setter: (mode: 'grouped' | 'single') => void) => {
      const isGrouped = mode === 'grouped';
      return (
        <div className="relative flex justify-between bg-gray-100 dark:bg-gray-800 rounded-full p-2 w-[200px] h-10">
          {/* Knob deslizante */}
          <span
            className={`absolute top-1 bottom-1 left-1 w-1/2 rounded-full bg-white dark:bg-gray-700 shadow-sm transition-all duration-300 ${
              isGrouped ? 'translate-x-0' : 'translate-x-[92px]'
            }`}
          />
          <button
            onClick={() => setter('grouped')}
            className={`relative z-10 flex items-center gap-1 pl-4 p-0 text-[11px] font-semibold rounded-full transition-colors ${
              isGrouped ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <FileStack className="w-4 h-4"/> Grupo
          </button>
          <button
            onClick={() => setter('single')}
            className={`relative z-10 flex items-center gap-1 -pl-2 p-3 text-[10px] font-semibold rounded-full transition-colors ${
              !isGrouped ? 'text-orange-500 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <FileCode className="w-4 h-4"/> Individual
          </button>
        </div>
      );
    };

    const renderStackedBar = (map: Record<string, number>) => {
      const totalBar = Object.values(map).reduce((sum, val) => sum + val, 0);
      if (totalBar === 0) return <div className="h-3 w-full bg-apple-card-light dark:bg-apple-card-dark rounded-full" />;
      return (
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-apple-card-light dark:bg-apple-card-dark gap-1">
          {Object.entries(map).map(([key, value], index) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div key={key} style={{ flexGrow: value, backgroundColor: color, filter: "saturate(60%)" }} />
            );
          })}
        </div>
      );
    };

    const modalMap = modalViewMode === 'grouped' ? (categoryGroup || {}) : (category || {});
    const modalEntries = Object.entries(modalMap).sort();

    return (
      <>
        <div
          ref={cardRef}
          className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm relative flex flex-col h-[280px] transition-all duration-300"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark truncate">{title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              {renderToggle(viewMode, setViewMode)}
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Ver todas as categorias"
              >
                <Maximize2 className="w-4 h-4 text-apple-tertiary-light dark:text-apple-tertiary-dark" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{totalItems}</span>
            <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
              Observações{viewMode === 'grouped' ? ' agrupadas' : ' individuais'}
            </span>
          </div>

          {/* Barra */}
          <div className="mt-4">{renderStackedBar(categoryMap)}</div>

          {/* Lista de categorias em grid 2 colunas, com limite de 5 itens + link "Ver todas" */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {visibleEntries.length === 0 ? (
              <div className="text-sm text-apple-tertiary-light">Sem dados para exibir</div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {visibleEntries.map(([key, value], index) => (
                  <div
                    key={key}
                    ref={itemRef}
                    className={`flex items-center gap-2 cursor-pointer transition-colors ${
                      activeCategory === key ? 'text-apple-blue underline' : 'hover:text-apple-blue hover:underline'
                    }`}
                    onClick={(e) => handleClick(key, e)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                    <span className="flex-1 text-xs truncate" title={key}>{key}</span>
                    <span className="font-semibold text-xs shrink-0">{value}</span>

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
                          {Object.entries(categoryDetails[key]).sort((a, b) => b[1] - a[1]).map(([pattern, count], i) => (
                            <div key={pattern} className={`flex items-center justify-between px-4 py-2 text-sm ${i % 2 === 0 ? 'bg-apple-bg-light/80 dark:bg-apple-card-dark/70' : ''}`}>
                              <span className="truncate pr-2 text-apple-tertiary-light dark:text-apple-secondary-dark">{pattern}</span>
                              <span className="font-semibold text-apple-label-light dark:text-apple-label-dark">{count}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 border-t border-apple-border-light dark:border-apple-border-dark flex justify-between items-center bg-apple-bg-light/30 dark:bg-apple-card-dark/10">
                          <span className="text-xs font-bold uppercase text-apple-tertiary-light dark:text-apple-tertiary-dark">Total</span>
                          <span className="text-sm font-bold text-apple-label-light dark:text-apple-label-dark">{Object.values(categoryDetails[key]).reduce((a, b) => a + b, 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 🔥 6º slot: link "Ver todas" quando houver mais de 5 categorias */}
                {hasMoreItems && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 cursor-pointer transition-colors text-apple-blue hover:text-apple-blue/80 hover:underline"
                    title="Ver todas as categorias"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">Ver todas ({entries.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🔥 Modal de Detalhes com transição suave */}
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 transition-all duration-300 ${
            isModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 ${
              isModalOpen ? 'scale-100' : 'scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-apple-border-light dark:border-apple-border-dark">
              <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">Distribuição por Categoria</h3>
              <div className="flex items-center gap-3">
                {renderToggle(modalViewMode, setModalViewMode)}
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X className="w-5 h-5 text-apple-tertiary-light dark:text-apple-tertiary-dark" /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-8">{renderStackedBar(modalMap)}</div>
              <div className="space-y-8">
                {modalEntries.length === 0 ? (
                  <div className="text-center text-apple-tertiary-light py-10">Sem dados para exibir</div>
                ) : (
                  modalEntries.map(([cat, catTotal], index) => (
                    <div key={cat}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                        <span className="text-base font-bold text-apple-label-light dark:text-apple-label-dark">{cat}</span>
                        <span className="ml-auto text-lg font-bold text-apple-label-light dark:text-apple-label-dark">{catTotal}</span>
                      </div>
                      {categoryDetails?.[cat] && Object.keys(categoryDetails[cat]).length > 0 ? (
                        <div className="ml-7 space-y-1 border-l border-apple-border-light dark:border-apple-border-dark pl-4">
                          {Object.entries(categoryDetails[cat]).sort((a, b) => b[1] - a[1]).map(([pattern, count]) => (
                            <div key={pattern} className="flex justify-between text-sm py-1">
                              <span className="text-apple-tertiary-light dark:text-apple-secondary-dark truncate pr-4">{pattern}</span>
                              <span className="font-semibold text-apple-label-light dark:text-apple-label-dark shrink-0">{count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ml-7 text-sm text-apple-tertiary-light">Sem detalhes para esta categoria</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ===================== CARD DE SEVERIDADE (variante compacta) =====================
  if (type === 'status' && variant === 'compact') {
    return (
      <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 items-center">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-apple-label-light dark:text-apple-label-dark uppercase tracking-wide">
              {title}
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{total}</span>
              <span className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark">Observações</span>
            </div>
            {severityBar()}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {severityLegend()}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['open', 'resolved', 'recurring', 'wont_fix'].map((key) => {
              const config = STATUS_CONFIG[key] || { label: key, icon: Eye, color: '#9ca3af', bg: '#f3f4f6' };
              const Icon = config.icon;
              const count = status?.[key] || 0;
              return (
                <div key={key} className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-50 dark:bg-[#131315] border border-gray-100 dark:border-gray-700/50 text-center">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg mb-2" style={{ backgroundColor: config.bg }}>
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </span>
                  <span className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark">{count}</span>
                  <span className="text-[10px] font-medium text-apple-tertiary-light dark:text-apple-tertiary-dark mt-1">
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===================== CARD DE SEVERIDADE (variante padrão) =====================
  return (
    <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-6 pb-4 bg-white dark:bg-apple-card-dark">
        <h3 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">{title}</h3>
        <div className="mt-4">{severityBar()}</div>
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">{total}</span>
            <span className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">Observações</span>
          </div>
          <div className="flex items-center gap-4">{severityLegend()}</div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-4 border-t border-gray-200 dark:border-apple-border-dark bg-gray-100 dark:bg-[#131315]">
        {renderStatusItem('open')}
        {renderStatusItem('resolved')}
        {renderStatusItem('recurring')}
        {renderStatusItem('wont_fix')}
      </div>
    </div>
  );
}