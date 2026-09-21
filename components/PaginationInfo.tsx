// components/PaginationInfo.tsx
"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import type { DataTableAction } from "./DataTable";

// ============================================================
// Tipos compartilhados
// ============================================================
interface TableToolbarProps<T> {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (size: number) => void;
  exportActions?: DataTableAction<T>[];
  viewMode?: "table" | "cards";
  onViewModeChange?: (mode: "table" | "cards") => void;
}

interface TablePaginationProps<T> {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectable?: boolean;
  selectedIds?: string[];
  selectedItems?: T[];
  onClearSelection?: () => void;
  bulkActions?: DataTableAction<T>[];
}

// ============================================================
// Toolbar (topo)
// ============================================================
export function TableToolbar<T>({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  exportActions = [],
  viewMode = "table",
  onViewModeChange,
}: TableToolbarProps<T>) {
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-elevated dark:bg-sunken border border-sunken rounded-lg">
      {/* Esquerda: contagem + itens por página */}
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="whitespace-nowrap">
          Exibindo{" "}
          <span className="font-medium text-heading">
            {firstItem}–{lastItem}
          </span>{" "}
          de <span className="font-medium text-heading">{totalItems}</span>
        </span>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-surface border border-strong rounded-md px-2 py-1 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
          aria-label="Itens por página"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} / pág
            </option>
          ))}
        </select>
      </div>

      {/* Direita: toggle + exports */}
      <div className="flex items-center gap-2">
        {onViewModeChange && (
          <button
            type="button"
            onClick={() =>
              onViewModeChange(viewMode === "table" ? "cards" : "table")
            }
            className="flex items-center justify-center p-1.5 rounded-md text-muted hover:text-brand hover:bg-brand/10 transition-colors"
            title={viewMode === "table" ? "Ver como cards" : "Ver como tabela"}
            aria-label={
              viewMode === "table" ? "Ver como cards" : "Ver como tabela"
            }
          >
            {viewMode === "table" ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <TableIcon className="w-4 h-4" />
            )}
          </button>
        )}

        {exportActions.length > 0 && (
          <div
            className={`flex items-center gap-1 ${
              onViewModeChange ? "pl-2 border-l border-strong" : ""
            }`}
          >
            {exportActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => action.onClick([], [])}
                disabled={action.disabled}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Pagination (base)
// ============================================================
export function TablePagination<T>({
  currentPage,
  totalPages,
  onPageChange,
  selectable,
  selectedIds = [],
  selectedItems = [],
  onClearSelection,
  bulkActions = [],
}: TablePaginationProps<T>) {
  const hasSelection = selectable && selectedIds.length > 0;

  const handleAction = (action: DataTableAction<T>) => {
    if (action.disabled) return;
    if (action.requiresSelection && selectedIds.length === 0) return;
    action.onClick(selectedIds, selectedItems);
  };

  const isDangerAction = (label: string) =>
    /excluir|remover|deletar/i.test(label);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-elevated dark:bg-sunken border border-sunken rounded-lg">
      {/* Esquerda: seleção + bulk actions */}
      <div className="flex items-center gap-3 min-h-[32px]">
        {hasSelection && (
          <>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-brand whitespace-nowrap">
                {selectedIds.length}{" "}
                {selectedIds.length === 1
                  ? "item selecionado"
                  : "itens selecionados"}
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="flex items-center justify-center p-0.5 rounded-full text-brand hover:bg-brand/20 transition-colors"
                title="Limpar seleção"
                aria-label="Limpar seleção"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {bulkActions.length > 0 && (
              <div className="flex items-center gap-1 pl-3 border-l border-strong">
                {bulkActions.map((action) => {
                  const danger = isDangerAction(action.label);
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleAction(action)}
                      disabled={action.disabled}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        danger
                          ? "text-error hover:bg-apple-red/10"
                          : "text-muted hover:text-brand hover:bg-brand/10"
                      }`}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Direita: navegação */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-md text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Primeira página"
          aria-label="Primeira página"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-md text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 mx-2">
          <input
            type="number"
            min={1}
            max={Math.max(1, totalPages)}
            value={currentPage}
            onChange={(e) => {
              const p = parseInt(e.target.value, 10);
              if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
                onPageChange(p);
              }
            }}
            className="w-12 text-center bg-surface border border-strong rounded-md px-2 py-1 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
            aria-label="Página atual"
          />
          <span className="text-sm text-muted whitespace-nowrap">
            / {totalPages || 1}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-md text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Próxima página"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-md text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Última página"
          aria-label="Última página"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
