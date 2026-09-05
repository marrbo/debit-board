"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';
import { SimpleColumnSearch } from '@/components/dbql/SimpleColumnSearch';
import { ChevronUp, ChevronDown, LoaderCircle, Trash2, FileText, FileSpreadsheet } from 'lucide-react';

// ============================================================
// Tipos
// ============================================================
export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T, extraData?: Record<string, any>) => React.ReactNode;
  sortable?: boolean;
  sortKey?: string;
  width?: string;
  minWidth?: string;
  nowrap?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string | ((item: T) => string);
  headerClassName?: string;
}

export interface DataTableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (selectedIds: string[], selectedItems: T[]) => void;
  disabled?: boolean;
  requiresSelection?: boolean;
}

export interface ExportFilters {
  q?: string;
  projectId?: string;
  search?: string;
  tenantId?: string;
}

export interface DataTableProps<T> {
  endpoint: string;
  columns: Column<T | any>[];
  defaultSort?: { field: string; order: 'asc' | 'desc' };
  defaultLimit?: number;
  searchPlaceholder?: string;
  searchContext?: string;
  userId: string;
  projectId?: string;
  teamId?: string;
  refreshKey?: number;
  onRowClick?: (item: T) => void;
  // Novos props
  selectable?: boolean;               // exibir coluna de checkboxes (default true)
  actions?: DataTableAction<T>[];     // ações customizadas
  canDelete?: boolean;                // permitir exclusão (default true)
  onDelete?: (selectedIds: string[]) => void; // callback de exclusão
  onExportExcel?: (filters: ExportFilters) => void;
  onExportPDF?: (filters: ExportFilters) => void;
  onSelectionChange?: (ids: string[]) => void;
  onSearchChange?: (search: string) => void;

  variant?: 'table' | 'cards';
  renderCard?: (item: T, extraData?: Record<string, any>) => React.ReactNode;
  extraData?: Record<string, any>;
}

// ============================================================
// Componente
// ============================================================
export function DataTable<T extends { _id: string }>({
  endpoint,
  columns,
  defaultSort = { field: 'createdAt', order: 'desc' },
  defaultLimit = 10,
  searchPlaceholder = 'Buscar...',
  searchContext = 'none',
  userId,
  projectId,
  teamId,
  refreshKey = 0,
  onRowClick,
  selectable = true,
  actions = [],
  canDelete = true,
  onDelete,
  onExportExcel,
  onExportPDF,
  variant = 'table',
  renderCard,
  extraData,
  onSelectionChange,
  onSearchChange,
  
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [sortField, setSortField] = useState(defaultSort.field);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSort.order);
  
  // Novos estados de seleção
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Estado da busca (DBQL ou simples)
  const [currentDbqlId, setCurrentDbqlId] = useState('');

  // ============================================================
  // Filtro client-side (para searchContext === 'none')
  // ============================================================
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  
  // ✅ Callback memoizado para busca DBQL
  const handleDbqlSearch = useCallback((id: string) => {
    setCurrentDbqlId(id);
    setPage(1);
    if (onSearchChange) onSearchChange(id); // 🔥 Dispara o filtro
  }, [onSearchChange]);

  // ✅ Callback memoizado para busca simples (client-side)
  const handleSimpleSearch = useCallback((column: string | null, value: string) => {
    setFilterColumn(column);
    setFilterValue(value);
    setPage(1); // reseta página apenas quando o filtro muda de fato
  }, []);

  // Sempre que selectedIds mudar, chame o callback
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);


  // Exportação com filtros atuais
  const buildExportFilters = useCallback((): ExportFilters => {
    return {
      q: currentDbqlId || undefined,
      projectId: projectId || undefined,
    };
  }, [currentDbqlId, projectId]);

  const exportActions = useMemo(() => {
    const acts: DataTableAction<T>[] = [];
    if (onExportPDF) {
      acts.push({
        label: "PDF",
        icon: <FileText className="w-4 h-4" />,
        onClick: () => onExportPDF(buildExportFilters()),
        requiresSelection: false,
      });
    }
    if (onExportExcel) {
      acts.push({
        label: "Excel",
        icon: <FileSpreadsheet className="w-4 h-4" />,
        onClick: () => onExportExcel(buildExportFilters()),
        requiresSelection: false,
      });
    }
    return acts;
  }, [onExportPDF, onExportExcel, buildExportFilters]);

  // ============================================================
  // Busca de dados (server-side para DBQL, client-side para simples)
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort: sortField,
          order: sortOrder,
          ...(projectId && { projectId }),
          ...(teamId && { teamId }),
        });

        if (searchContext !== 'none' && currentDbqlId) {
          params.set('q', currentDbqlId);
        }

        const res = await fetch(`${endpoint}?${params}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            // ✅ Extrai os dados e o total geral
            const items = json.data || [];
            const totalItems = json.total ?? items.length; // total deve ser o total geral (14)

            setData(items);
            setTotal(totalItems);

            // ✅ Calcula totalPages localmente - nunca confiar em json.totalPages
            const calculatedTotalPages = Math.ceil(totalItems / limit);

            // ✅ Se a página atual exceder o total de páginas, volta para a última
            if (page > calculatedTotalPages) {
              setPage(Math.max(1, calculatedTotalPages));
            }

            // ✅ Limpa seleção se os itens não estão mais na lista
            const newIds = items.map((item: T) => item._id);
            setSelectedIds(prev => prev.filter(id => newIds.includes(id)));
          }
        } else {
          console.error('Erro ao buscar dados', res.statusText);
        }
      } catch (error) {
        if (!cancelled) console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, page, limit, sortField, sortOrder, teamId, currentDbqlId, projectId, refreshKey, searchContext]);

  // ============================================================
  // Filtro client-side
  // ============================================================
  const filteredData = useMemo(() => {
    if (searchContext !== 'none') return data;
    if (!filterValue) return data;

    return data.filter((item) => {
      const value = String(filterValue).toLowerCase();
      if (!filterColumn) {
        return Object.entries(item).some(([val]) => {
          if (typeof val === 'object' || val === null) return false;
          return String(val).toLowerCase().includes(value);
        });
      } else {
        const cellValue = (item as any)[filterColumn];
        if (cellValue === undefined) return false;
        return String(cellValue).toLowerCase().includes(value);
      }
    });
  }, [data, filterColumn, filterValue, searchContext]);

  // ============================================================
  // Seleção
  // ============================================================
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    setSelectAll(false);
  }, []);

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item._id));
    }
    setSelectAll(!selectAll);
  };

  const selectedItems = useMemo(
    () => filteredData.filter(item => selectedIds.includes(item._id)),
    [filteredData, selectedIds]
  );

  // Ações nativas e customizadas
  const nativeActions = useMemo(() => {
    const act: DataTableAction<T>[] = [];
    if (canDelete && onDelete) {
      act.push({
        label: 'Excluir',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: (ids) => onDelete(ids),
        disabled: false,
      });
    }
    return act;
  }, [canDelete, onDelete]);

  const allActions = [...exportActions, ...nativeActions, ...actions];

  // Renderiza botões na barra de ações, mesmo sem seleção
  // (se exportActions não estiver vazio, mostra uma barra separada)
  const showExportBar = exportActions.length > 0 && selectedIds.length === 0;

  // ============================================================
  // Ordenação e estilos (como antes)
  // ============================================================
  const handleSort = (col: Column<T>) => {
    const field = col.sortKey || String(col.key);
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const totalPages = Math.ceil(total / limit);

  const getCellStyle = (col: Column<T>) => {
    const style: React.CSSProperties = {};
    if (col.width) style.width = col.width;
    if (col.minWidth) style.minWidth = col.minWidth;
    if (col.nowrap) style.whiteSpace = 'nowrap';
    if (col.align) style.textAlign = col.align;
    return style;
  };

  const getCellClassName = (col: Column<T>, item: T) => {
    const base = col.className;
    if (typeof base === 'function') return base(item);
    return base || '';
  };

  // ============================================================
  // Renderização das colunas (incluindo coluna de seleção)
  // ============================================================
  const renderColumns = useMemo(() => {
    const cols: Column<T>[] = [];
    if (selectable) {
      cols.push({
        key: '__select',
        label: '',
        width: '40px',
        align: 'center',
        sortable: false,
        render: (item: T) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(item._id)}
            onChange={() => toggleSelection(item._id)}
            className="w-4 h-4 rounded border-gray-300 text-apple-blue focus:ring-apple-blue"
          />
        ),
        headerClassName: 'w-10',
      });
    }
    // Adiciona colunas originais
    for (const col of columns) {
      cols.push(col);
    }
    return cols;
  }, [selectable, columns, selectedIds, toggleSelection]);

    // ============================
  // RENDER CARDS MODE
  // ============================
  if (variant === 'cards') {
    return (
      <div className="space-y-4">
        {searchContext !== 'none' ? (
          <DBQLAdvancedSearch onSearch={handleDbqlSearch} userId={userId} placeholder={searchPlaceholder} context={searchContext} />
        ) : (
          <SimpleColumnSearch columns={columns} onSearch={handleSimpleSearch} placeholder={searchPlaceholder} />
        )}

        {showExportBar && (
          <div className="flex justify-end gap-2">
            {exportActions.map((action, idx) => (
              <button key={idx} onClick={() => action.onClick([], [])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-apple-tertiary-light/10 hover:bg-apple-tertiary-light/20">
                {action.icon}{action.label}
              </button>
            ))}
          </div>
        )}

        {selectable && selectedIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light rounded-xl shadow-sm">
            <div className="text-sm">{selectedIds.length} selecionado(s)</div>
            <div className="flex gap-2">
              {allActions.map((action, idx) => (
                <button key={idx} onClick={() => action.onClick(selectedIds, selectedItems)} disabled={action.disabled} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-apple-tertiary-light/10 disabled:opacity-40">
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full p-4 text-center">
              <LoaderCircle className="w-10 h-10 mx-auto animate-spin text-apple-tertiary-light" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="col-span-full p-4 text-center text-apple-tertiary-light">Nenhum registro encontrado.</div>
          ) : (
            filteredData.map((item) => (
              <div key={item._id} onClick={() => onRowClick?.(item)} className="cursor-pointer">
                {renderCard ? renderCard(item, extraData) : <div>Card</div>}
              </div>
            ))
          )}
        </div>

        {!loading && total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div>Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}</div>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded border disabled:opacity-50">Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border disabled:opacity-50">Próxima</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // JSX
  // ============================================================
  return (
    <div className="space-y-4">
      {/* Barra de busca */}
      {searchContext !== 'none' ? (
        <DBQLAdvancedSearch
          onSearch={handleDbqlSearch}
          userId={userId}
          placeholder={searchPlaceholder}
          context={searchContext}
        />
      ) : (
        <SimpleColumnSearch
          columns={columns}
          onSearch={handleSimpleSearch}
          placeholder={searchPlaceholder}
        />
      )}

      {/* Barra de exportação (sem seleção) */}
      {showExportBar && (
        <div className="flex justify-end gap-2">
          {exportActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => action.onClick([], [])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-apple-tertiary-light/10 text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/20"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Barra de ações (aparece quando há seleção) */}
      {selectable && selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
            <span className="font-semibold">{selectedIds.length} selecionado(s)</span>
            <button
              onClick={() => {
                setSelectedIds([]);
                setSelectAll(false);
              }}
              className="text-apple-blue hover:underline"
            >
              Limpar
            </button>
          </div>
          <div className="flex items-center gap-2">
            {allActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => action.onClick(selectedIds, selectedItems)}
                disabled={action.disabled || (action.requiresSelection && selectedIds.length === 0)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  action.label === 'Excluir'
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'bg-apple-tertiary-light/10 text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/20'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left" style={{ tableLayout: renderColumns.some(c => c.width) ? 'fixed' : 'auto' }}>
          <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-tertiary-light dark:text-apple-tertiary-dark border-b border-apple-border-light dark:border-apple-border-dark">
            <tr>
              {/* Checkbox para selecionar todos */}
              {selectable && (
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && filteredData.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-apple-blue focus:ring-apple-blue"
                  />
                </th>
              )}
              {renderColumns
                .filter(col => col.key !== '__select')
                .map((col) => (
                  <th
                    key={String(col.key)}
                    className={`p-4 ${col.sortable ? 'cursor-pointer' : ''} font-medium ${col.headerClassName || ''}`}
                    style={getCellStyle(col)}
                    onClick={() => col.sortable !== false && handleSort(col)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && sortField === String(col.key) && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
            {loading ? (
              <tr>
                <td colSpan={renderColumns.length} className="p-4 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">
                  <LoaderCircle className="w-10 h-10 mx-auto animate-spin text-apple-tertiary-light dark:text-apple-tertiary-dark" />
                  Carregando...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={renderColumns.length} className="p-4 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr
                  key={item._id}
                  onClick={() => onRowClick?.(item)}
                  className={`hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {/* Coluna de seleção */}
                  {selectable && (
                    <td className="p-4 text-center" style={getCellStyle(renderColumns[0])}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item._id)}
                        onChange={() => toggleSelection(item._id)}
                        className="w-4 h-4 rounded border-gray-300 text-apple-blue focus:ring-apple-blue"
                      />
                    </td>
                  )}
                  {renderColumns
                    .filter(col => col.key !== '__select')
                    .map((col) => (
                      <td
                        key={String(col.key)}
                        className={`p-4 ${getCellClassName(col, item)}`}
                        style={getCellStyle(col)}
                      >
                        {col.render ? col.render(item, extraData) : (item as any)[col.key] as React.ReactNode}
                      </td>
                    ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
          <div>
            Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-apple-border-light dark:border-apple-border-dark disabled:opacity-50"
            >
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-apple-border-light dark:border-apple-border-dark disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
          <div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-apple-border-light dark:border-apple-border-dark rounded px-2 py-1 bg-transparent"
            >
              {[5, 10, 25, 50].map((l) => (
                <option key={l} value={l}>{l} por página</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}