"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, LoaderCircle, Trash2, FileText, FileSpreadsheet } from 'lucide-react';
import { exportTableToPDF } from "./exportPDF";

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
  exportable?: boolean;
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
  projectId?: string;
  teamId?: string;
  refreshKey?: number;
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  actions?: DataTableAction<T>[];
  canDelete?: boolean;
  onDelete?: (selectedIds: string[]) => void;
  exportPDF?: boolean;
  exportOrientation?: 'portrait' | 'landscape';
  pdfTitle?: string;
  onExportPDF?: (filters: ExportFilters) => void;
  onExportExcel?: (filters: ExportFilters) => void;
  onSelectionChange?: (ids: string[]) => void;
  variant?: 'table' | 'cards';
  renderCard?: (item: T, extraData?: Record<string, any>) => React.ReactNode;
  extraData?: Record<string, any>;

  // 🔥 Novas props para busca externa
  searchQuery?: string;        // Para DBQL (server-side)
  filterColumn?: string | null; // Para Simple (client-side)
  filterValue?: string;         // Para Simple (client-side)
}

// ============================================================
// Componente
// ============================================================
export function DataTable<T extends { _id: string }>({
  endpoint,
  columns,
  defaultSort = { field: 'createdAt', order: 'desc' },
  defaultLimit = 10,
  projectId,
  teamId,
  refreshKey = 0,
  onRowClick,
  selectable = true,
  actions = [],
  canDelete = true,
  onDelete,
  exportPDF = true,
  exportOrientation = 'portrait',
  pdfTitle,
  onExportPDF,
  onExportExcel,
  variant = 'table',
  renderCard,
  extraData,
  onSelectionChange,
  searchQuery = '',
  filterColumn = null,
  filterValue = '',
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


  // Sempre que selectedIds mudar, chame o callback
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);


  // Exportação com filtros atuais
  const buildExportFilters = useCallback((): ExportFilters => {
    return {
      projectId: projectId || undefined,
    };
  }, [projectId]);

  // ============================================================
  // Fetch de dados (usa searchQuery para server-side)
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

        // 🔥 Se houver busca server-side, adiciona o parâmetro
        if (searchQuery) {
          params.set('q', searchQuery);
        }

        const url = new URL(endpoint, window.location.origin);
        params.forEach((value, key) => {
          url.searchParams.append(key, value);
        });

        const res = await fetch(url.toString());

        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            const items = json.data || [];
            const totalItems = json.total ?? items.length;
            setData(items);
            setTotal(totalItems);
            const calculatedTotalPages = Math.ceil(totalItems / limit);
            if (page > calculatedTotalPages) {
              setPage(Math.max(1, calculatedTotalPages));
            }
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

    return () => { cancelled = true; };
  }, [endpoint, page, limit, sortField, sortOrder, teamId, searchQuery, projectId, refreshKey]);

  // ============================================================
  // Filtro client-side (para SimpleSearch)
  // ============================================================
  const filteredData = useMemo(() => {
    if (!filterValue) return data;

    return data.filter((item) => {
      const value = String(filterValue).toLowerCase();
      if (!filterColumn) {
        return Object.entries(item).some(([_, val]) =>
          typeof val !== 'object' && val !== null &&
          String(val).toLowerCase().includes(value)
        );
      } else {
        const cellValue = (item as unknown as Record<string, unknown>)[filterColumn];
        if (cellValue === undefined) return false;
        return String(cellValue).toLowerCase().includes(value);
      }
    });
  }, [data, filterColumn, filterValue]);


  // ============================================================
  // Antes de exportar para PDF faz um fetch ALL
  // para retornar todos os dados de todas as páginas 
  // mantendo o filtro e parâmetros de busca
  // ============================================================
  const fetchAllForExport = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        all: "true", // 🔥 Força a API a retornar todos
        sort: sortField,
        order: sortOrder,
        ...(projectId && { projectId }),
        ...(teamId && { teamId }),
      });

      // 🔥 Inclui a busca server-side (DBQL) na exportação
      if (searchQuery) {
        params.set('q', searchQuery);
      }

      const url = new URL(endpoint, window.location.origin);
      params.forEach((value, key) => {
        url.searchParams.append(key, value);
      });

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Falha ao buscar todos os dados');
      const json = await res.json();
      let items = json.data || [];

      // Se for busca client-side, aplica o filtro local
      if (filterValue) {
        const value = String(filterValue).toLowerCase();
        items = items.filter((item: any) => {
          if (!filterColumn) {
            return Object.entries(item).some(([_, val]) =>
              typeof val !== 'object' && val !== null &&
              String(val).toLowerCase().includes(value)
            );
          } else {
            return String((item as any)[filterColumn] ?? '').toLowerCase().includes(value);
          }
        });
      }

      return items;
    } catch (error) {
      console.error('Erro ao buscar todos os dados para exportação:', error);
      return []; // fallback vazio
    }
  }, [endpoint, sortField, sortOrder, projectId, teamId, searchQuery, filterValue, filterColumn]);

  // ============================================================
  // Exportação nativa básica de PDF
  // ============================================================
  const handleNativeExportPDF = useCallback(async () => {
    // 🔥 Busca todos os dados (sem paginação)
    const exportData = await fetchAllForExport();

    // Se não retornou nada, usa os dados atuais da página
    const finalData = exportData.length > 0 ? exportData : filteredData;

    // Filtra colunas não exportáveis
    const exportColumns = columns
      .filter((col) => col.key !== "__select")
      .filter((col) => col.exportable !== false)
      .filter((col) => {
        const key = String(col.key).toLowerCase();
        if (key === "actions" || key.includes("action")) return false;
        return true;
      })
      .map((col) => ({
        key: String(col.key),
        label: col.label,
        render: col.render ? (item: any) => col.render!(item, extraData) : undefined,
      }));

    // 🔥 Título seguro: usa pdfTitle ou "Relatório" (nunca searchContext)
    const safeTitle = pdfTitle || "Relatório";
    const safeFilename = `Debit-Board_Relatorio_${safeTitle}`
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '.pdf';

    exportTableToPDF({
      title: safeTitle,
      subtitle: "Debit Board - Relatório de Dados",
      columns: exportColumns,
      data: finalData,
      filename: safeFilename,
      orientation: exportOrientation
    });
  }, [fetchAllForExport, filteredData, columns, pdfTitle, exportOrientation, extraData]);


  const exportActions = useMemo(() => {
    const acts: DataTableAction<T>[] = [];

    if (onExportPDF) {
      acts.push({
        label: "PDF",
        icon: <FileText className="w-4 h-4" />,
        onClick: () => onExportPDF(buildExportFilters()),
        requiresSelection: false,
      });
    } else if (exportPDF !== false) {
      // 🔥 Exportação nativa
      acts.push({
        label: "PDF",
        icon: <FileText className="w-4 h-4" />,
        onClick: async () => {
          await handleNativeExportPDF();
        },
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
  }, [onExportPDF, onExportExcel, buildExportFilters, exportPDF, handleNativeExportPDF]);

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
            className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
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
          <div className="flex items-center justify-between px-4 py-2 bg-page dark:bg-surface border border-default rounded-xl shadow-sm hover:drop-shadow-lg">
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
              <LoaderCircle className="w-10 h-10 mx-auto animate-spin text-muted" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="col-span-full p-4 text-center text-muted">Nenhum registro encontrado.</div>
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

      {/* Barra de exportação (sem seleção) */}
      <div className="flex justify-between items-center align-middle">
        {!loading && total > 0 && (
          <div className="relative h-10 px-2 py-5 w-100 text-xs text-muted dark:text-muted">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
          </div>
        )}
      
        {showExportBar && (
          <div className="flex justify-end gap-2">
            {exportActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => action.onClick([], [])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-apple-tertiary-light/10 text-heading dark:text-heading hover:bg-apple-tertiary-light/20"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Barra de ações (aparece quando há seleção) */}
        {selectable && selectedIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-page dark:bg-surface border border-default dark:border-strong rounded-xl shadow-sm hover:drop-shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted dark:text-muted">
              <span className="font-semibold">{selectedIds.length} selecionado(s)</span>
              <button
                onClick={() => {
                  setSelectedIds([]);
                  setSelectAll(false);
                }}
                className="text-brand hover:underline"
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
                      : 'bg-apple-tertiary-light/10 text-heading dark:text-heading hover:bg-apple-tertiary-light/20'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-elevated dark:bg-dark/20 border border-default dark:border-strong rounded-2xl overflow-hidden shadow-sm hover:drop-shadow-lg">
        <table className="w-full text-sm text-left" style={{ tableLayout: renderColumns.some(c => c.width) ? 'fixed' : 'auto' }}>
          <thead className="bg-sunken text-muted dark:text-muted border-b border-default dark:border-strong">
            <tr>
              {/* Checkbox para selecionar todos */}
              {selectable && (
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectAll && filteredData.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border text-brand"
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
                <td colSpan={renderColumns.length} className="p-4 text-center text-muted dark:text-muted">
                  <LoaderCircle className="w-10 h-10 mx-auto animate-spin text-muted dark:text-muted" />
                  Carregando...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={renderColumns.length} className="p-4 text-center text-muted dark:text-muted">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr
                  key={item._id}
                  onClick={() => onRowClick?.(item)}
                  className={`hover:bg-page dark:hover:bg-surface border-sunken dark:border-surface  transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {/* Coluna de seleção */}
                  {selectable && (
                    <td className="p-4 text-center" style={getCellStyle(renderColumns[0])}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item._id)}
                        onChange={() => toggleSelection(item._id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
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
        <div className="flex items-center justify-between text-sm text-muted dark:text-muted">
          <div className="px-2 w-100 text-xs text-muted dark:text-muted" >
            Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-default dark:border-strong disabled:opacity-50"
            >
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-default dark:border-strong disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
          <div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-default dark:border-strong rounded px-2 py-1 bg-transparent"
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