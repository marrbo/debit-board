import React, { useState, useId } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react';

export interface ActionItem<T = unknown> {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: (string | number)[], selectedItems: T[]) => void;
  disabled?: boolean;
  requiresSelection?: boolean;
  variant?: 'default' | 'danger' | 'primary';
}

export interface TablePaginationProps<T = unknown> {
  // Estado da Paginação
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];

  // Estado de Seleção em Massa
  selectable?: boolean;
  selectedIds?: (string | number)[];
  selectedItems?: T[];
  onClearSelection?: () => void;

  // Ações Externas e Exportação
  showExportBar?: boolean;
  exportActions?: ActionItem<T>[];
  allActions?: ActionItem<T>[];

  className?: string;
}

/**
 * Calculador do intervalo de páginas com reticências dinâmicas.
 */
function getPaginationRange(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - 1, 1);
  const rightSibling = Math.min(currentPage + 1, totalPages);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    return [1, 2, 3, 4, '...', totalPages];
  }

  if (showLeftDots && !showRightDots) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', leftSibling, currentPage, rightSibling, '...', totalPages];
}

export function TablePagination<T = unknown>({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  selectable = false,
  selectedIds = [],
  selectedItems = [],
  onClearSelection,
  showExportBar = false,
  exportActions = [],
  allActions = [],
  className = '',
}: TablePaginationProps<T>) {
  const [jumpPage, setJumpPage] = useState<string>('');
  const pageSizeId = useId();
  const jumpInputId = useId();

  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const hasSelection = selectable && selectedIds.length > 0;

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= safeTotalPages) {
      onPageChange(parsed);
      setJumpPage('');
    }
  };

  const paginationRange = getPaginationRange(currentPage, safeTotalPages);

  return (
    <nav
      role="navigation"
      aria-label="Controles da tabela e paginação"
      className={`flex flex-col gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] transition-all ${className}`}
    >
      {/* SEÇÃO SUPERIOR: BARRA CONTEXTUAL DE SELEÇÃO EM MASSA (RENDERIZADA SE HOUVER ITENS SELECIONADOS) */}
      {hasSelection ? (
        <div
          role="region"
          aria-live="polite"
          aria-label="Ações de seleção em massa"
          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--radius-md)] animate-fadeIn"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-heading)]">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[var(--brand-subtle)] text-[var(--brand-default)] font-semibold">
              {selectedIds.length}
            </span>
            <span>item(ns) selecionado(s)</span>
            
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex items-center gap-1 ml-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)] underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] rounded-[var(--radius-sm)]"
              >
                <X className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {allActions.map((action, idx) => {
              const isDanger = action.variant === 'danger' || action.label.toLowerCase().includes('excluir');
              const isDisabled = action.disabled || (action.requiresSelection && selectedIds.length === 0);

              return (
                <button
                  key={`${action.label}-${idx}`}
                  type="button"
                  onClick={() => action.onClick(selectedIds, selectedItems)}
                  disabled={isDisabled}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDanger
                      ? 'bg-[var(--error-50)] text-[var(--error-700)] dark:bg-[var(--error-900)]/30 dark:text-[var(--error-300)] hover:bg-[var(--error-100)] dark:hover:bg-[var(--error-900)]/50'
                      : 'bg-[var(--bg-hover)] text-[var(--text-heading)] hover:bg-[var(--bg-active)]'
                  }`}
                >
                  {action.icon && <span className="w-3.5 h-3.5">{action.icon}</span>}
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* SEÇÃO PRINCIPAL: CONTROLES DE PAGINAÇÃO E EXPORTAÇÃO */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between text-xs text-[var(--text-muted)]">
        
        {/* LADO ESQUERDO: RESUMO E SELETOR DE TAMANHO DA PÁGINA */}
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <span className="whitespace-nowrap font-medium text-[var(--text-body)]">
            Exibindo <strong className="font-semibold text-[var(--text-heading)]">{startItem}</strong>–
            <strong className="font-semibold text-[var(--text-heading)]">{endItem}</strong> de{' '}
            <strong className="font-semibold text-[var(--text-heading)]">{totalItems}</strong>
          </span>

          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <label htmlFor={pageSizeId} className="sr-only">
                Itens por página
              </label>
              <select
                id={pageSizeId}
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-[var(--bg-page)] text-[var(--text-body)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-xs focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none transition-colors cursor-pointer"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} / pág
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* CENTRO: NAVEGAÇÃO DE PÁGINAS */}
        <div className="flex items-center justify-between sm:justify-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] disabled:opacity-40 disabled:pointer-events-none transition-colors focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none"
              aria-label="Ir para a primeira página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] disabled:opacity-40 disabled:pointer-events-none transition-colors focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none"
              aria-label="Ir para a página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Números das Páginas (Desktop) */}
            <div className="hidden sm:flex items-center gap-1">
              {paginationRange.map((item, index) => {
                if (item === '...') {
                  return (
                    <span
                      key={`dots-${index}`}
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-disabled)] select-none"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  );
                }

                const isCurrent = currentPage === item;
                return (
                  <button
                    type="button"
                    key={`page-${item}`}
                    onClick={() => onPageChange(item)}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={`Página ${item}`}
                    className={`min-w-[2rem] h-8 px-2 flex items-center justify-center rounded-[var(--radius-sm)] text-xs font-medium transition-colors focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none ${
                      isCurrent
                        ? 'bg-[var(--brand-default)] text-[var(--brand-foreground)] font-semibold'
                        : 'hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] text-[var(--text-body)]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Indicador Simplificado (Mobile) */}
            <span className="sm:hidden px-2 text-xs font-medium text-[var(--text-body)]">
              {currentPage} / {safeTotalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === safeTotalPages}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] disabled:opacity-40 disabled:pointer-events-none transition-colors focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none"
              aria-label="Ir para a próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPageChange(safeTotalPages)}
              disabled={currentPage === safeTotalPages}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] disabled:opacity-40 disabled:pointer-events-none transition-colors focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none"
              aria-label="Ir para a última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Form de Salto Rápido */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <label htmlFor={jumpInputId} className="sr-only">
              Ir para a página
            </label>
            <input
              key={currentPage}
              id={jumpInputId}
              type="number"
              min={1}
              max={safeTotalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={String(currentPage)}
              className="w-12 bg-[var(--bg-page)] text-[var(--text-body)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-xs text-center focus:ring-2 focus:ring-[var(--border-focus)] focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[var(--text-muted)] select-none">/ {safeTotalPages}</span>
          </form>
        </div>

        {/* LADO DIREITO: AÇÕES DE EXPORTAÇÃO */}
        {showExportBar && exportActions.length > 0 && (
          <div className="flex items-center justify-end gap-1.5 border-t lg:border-t-0 pt-2 lg:pt-0 border-[var(--border-subtle)]">
            {exportActions.map((action, idx) => (
              <button
                key={`${action.label}-${idx}`}
                type="button"
                onClick={() => action.onClick(selectedIds, selectedItems)}
                disabled={action.disabled}
                className="inline-flex group items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--bg-hover)] text-[var(--text-heading)] hover:bg-[var(--bg-active)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {action.icon && <span className="w-3.5 h-3.5">{action.icon}</span>}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}