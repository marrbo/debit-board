"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import type { Types } from "mongoose";
import {
  LoaderCircle,
  Trash2,
  ListChevronsUpDown,
  ListSortAscending,
  ListSortDescending,
} from "lucide-react";
import { FaFileExcel, FaFilePdf } from "react-icons/fa";
import { exportTableToPDF } from "./exportPDF";
import { exportTableToExcel } from "./exportExcel";
import { TablePagination } from "../PaginationInfo";

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
  align?: "left" | "center" | "right";
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
  defaultSort?: { field: string; order: "asc" | "desc" };
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
  exportOrientation?: "portrait" | "landscape";
  pdfTitle?: string;
  onExportPDF?: (filters: ExportFilters) => void;
  onExportExcel?: (filters: ExportFilters) => void;
  onSelectionChange?: (ids: string[]) => void;
  variant?: "table" | "cards";
  renderCard?: (item: T, extraData?: Record<string, any>) => React.ReactNode;
  extraData?: Record<string, any>;
  searchQuery?: string;
  filterColumn?: string | null;
  filterValue?: string;
  filterFunction?: (item: T) => boolean;
}

// ============================================================
// Helpers (módulo — referência estável, não recriados por render)
// ============================================================

/**
 * Normaliza `_id` (ObjectId | string) em string.
 * O driver serializa ObjectId como hex string no JSON, então no cliente o
 * `_id` já é string; no servidor continua ObjectId. Este helper unifica
 * os dois casos em um único ponto.
 */
function toIdString(id: string | Types.ObjectId): string {
  return typeof id === "string" ? id : id.toString();
}

/**
 * Constrói a URL final com validação same-origin.
 * Lança para endpoints cross-origin — proteção contra redirect malicioso.
 */
function buildEndpointUrl(endpoint: string, params: URLSearchParams): string {
  const url = new URL(endpoint, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    !["http:", "https:"].includes(url.protocol)
  ) {
    throw new Error("Endpoint inválido");
  }
  params.forEach((value, key) => url.searchParams.append(key, value));
  return url.toString();
}

/**
 * Filtra um item pelo valor informado (client-side).
 * Usado tanto no fetch principal quanto na exportação — antes estava
 * duplicado nos dois lugares.
 */
function matchesFilter<T>(
  item: T,
  filterColumn: string | null,
  filterValue: string,
): boolean {
  if (!filterValue) return true;
  const needle = filterValue.toLowerCase();

  if (!filterColumn) {
    return Object.entries(item as Record<string, unknown>).some(
      ([, val]) =>
        typeof val !== "object" &&
        val !== null &&
        String(val).toLowerCase().includes(needle),
    );
  }

  const cellValue = (item as unknown as Record<string, unknown>)[filterColumn];
  return (
    cellValue !== undefined && String(cellValue).toLowerCase().includes(needle)
  );
}

// ============================================================
// Skeleton
// ============================================================
function SkeletonTable({
  columns,
  rows,
}: {
  columns: Column<any>[];
  rows: number;
}) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
          {columns.map((col, colIndex) => (
            <td key={colIndex} className="p-4">
              <div
                className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                style={{ minWidth: col.minWidth || "4rem", width: col.width }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ============================================================
// Componente principal
// ============================================================
export function DataTable<T extends { _id: string | Types.ObjectId }>({
  endpoint,
  columns,
  defaultSort = { field: "createdAt", order: "desc" },
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
  exportOrientation = "portrait",
  pdfTitle,
  onExportPDF,
  onExportExcel,
  variant = "table",
  renderCard,
  extraData,
  onSelectionChange,
  searchQuery = "",
  filterColumn = null,
  filterValue = "",
  filterFunction,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [sortField, setSortField] = useState<string | null>(defaultSort.field);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(
    defaultSort.order,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // ============================================================
  // Seleção
  // ============================================================
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((item) => toIdString(item._id)));
    }
    setSelectAll(!selectAll);
  };

  // ============================================================
  // Dados filtrados (client-side + filterFunction)
  // ============================================================
  const filteredData = (() => {
    let result = data;
    if (filterValue) {
      result = result.filter((item) =>
        matchesFilter(item, filterColumn, filterValue),
      );
    }
    if (filterFunction) {
      result = result.filter(filterFunction);
    }
    return result;
  })();

  const selectedItems = filteredData.filter((item) =>
    selectedIds.includes(toIdString(item._id)),
  );

  // ============================================================
  // Colunas (inclui a coluna de seleção quando aplicável)
  // ============================================================
  const renderColumns = useMemo(() => {
    const cols: Column<T>[] = [];
    if (selectable) {
      cols.push({
        key: "__select",
        label: "",
        width: "40px",
        align: "center",
        sortable: false,
        render: (item: T) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(toIdString(item._id))}
            onChange={() => toggleSelection(toIdString(item._id))}
            className="w-4 h-4 rounded text-brand focus:ring-brand"
          />
        ),
      });
    }
    return [...cols, ...columns];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable, columns, selectedIds]);

  // ============================================================
  // Medir altura do cabeçalho (para o overlay de loading)
  // ============================================================
  useLayoutEffect(() => {
    if (theadRef.current) {
      setHeaderHeight(theadRef.current.offsetHeight);
    }
  }, [columns, selectable]);

  // ============================================================
  // Callback de seleção
  // ============================================================
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // ============================================================
  // Fetch de dados
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(projectId && { projectId }),
          ...(teamId && { teamId }),
        });
        if (sortField) params.set("sort", sortField);
        if (sortOrder) params.set("order", sortOrder);
        if (searchQuery) params.set("q", searchQuery);

        const res = await fetch(buildEndpointUrl(endpoint, params));
        if (!res.ok) throw new Error("Erro ao buscar dados");

        const json = await res.json();
        const items: T[] = Array.isArray(json) ? json : (json.data ?? []);
        const totalItems: number = Array.isArray(json)
          ? json.length
          : (json.total ?? items.length);

        if (!cancelled) {
          setData(items);
          setTotal(totalItems);

          const calculatedTotalPages = Math.max(
            1,
            Math.ceil(totalItems / limit),
          );
          if (page > calculatedTotalPages) {
            setPage(calculatedTotalPages);
          }

          const newIds = items.map((item) => toIdString(item._id));
          setSelectedIds((prev) => prev.filter((id) => newIds.includes(id)));
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
  }, [
    endpoint,
    page,
    limit,
    sortField,
    sortOrder,
    teamId,
    searchQuery,
    projectId,
    refreshKey,
  ]);

  // ============================================================
  // Exportação
  // ============================================================
  const fetchAllForExport = async (): Promise<T[]> => {
    try {
      const params = new URLSearchParams({
        all: "true",
        ...(projectId && { projectId }),
        ...(teamId && { teamId }),
      });
      if (sortField) params.set("sort", sortField);
      if (sortOrder) params.set("order", sortOrder);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(buildEndpointUrl(endpoint, params));
      if (!res.ok) throw new Error("Falha ao buscar todos os dados");

      const json = await res.json();
      let items: T[] = Array.isArray(json) ? json : (json.data ?? []);

      if (filterValue) {
        items = items.filter((item) =>
          matchesFilter(item, filterColumn, filterValue),
        );
      }
      if (filterFunction) {
        items = items.filter(filterFunction);
      }
      return items;
    } catch (error) {
      console.error("Erro ao buscar todos os dados para exportação:", error);
      return [];
    }
  };

  const buildExportColumns = () =>
    columns
      .filter((col) => col.key !== "__select" && col.exportable !== false)
      .filter((col) => {
        const key = String(col.key).toLowerCase();
        return key !== "actions" && !key.includes("action");
      })
      .map((col) => ({
        key: String(col.key),
        label: col.label,
        width: col.width,
        render: col.render
          ? (item: any) => col.render!(item, extraData)
          : undefined,
      }));

  const handleNativeExportExcel = async () => {
    const exportData = await fetchAllForExport();
    const finalData = exportData.length > 0 ? exportData : filteredData;

    const safeTitle = pdfTitle || "Relatório";
    const safeFilename =
      `Debit-Board_Relatorio_${safeTitle}`
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") + ".xlsx";

    exportTableToExcel({
      title: safeTitle,
      subtitle: "Debit Board - Relatório de Dados",
      columns: buildExportColumns(),
      data: finalData,
      filename: safeFilename,
    });
  };

  const handleNativeExportPDF = async () => {
    const exportData = await fetchAllForExport();
    const finalData = exportData.length > 0 ? exportData : filteredData;

    const safeTitle = pdfTitle || "Relatório";
    const safeFilename =
      `Debit-Board_Relatorio_${safeTitle}`
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") + ".pdf";

    exportTableToPDF({
      title: safeTitle,
      subtitle: "Debit Board - Relatório de Dados",
      columns: buildExportColumns(),
      data: finalData,
      filename: safeFilename,
      orientation: exportOrientation,
    });
  };

  // ============================================================
  // Ações nativas (PDF, Excel, Excluir)
  // ============================================================
  const exportActions: DataTableAction<T>[] = [];

  if (onExportPDF) {
    exportActions.push({
      label: "PDF",
      icon: <FaFilePdf className="w-3.5 h-3.5 text-red-600 group-hover:text-white" />,
      onClick: () => onExportPDF({ projectId }),
      requiresSelection: false,
    });
  } else if (exportPDF !== false) {
    exportActions.push({
      label: "PDF",
      icon: <FaFilePdf className="w-3.5 h-3.5 text-red-600 group-hover:text-white" />,
      onClick: handleNativeExportPDF,
      requiresSelection: false,
    });
  }

  if (onExportExcel) {
    exportActions.push({
      label: "Excel",
      icon: <FaFileExcel className="w-3.5 h-3.5 text-green-500 group-hover:text-white" />,
      onClick: () => onExportExcel({ projectId }),
      requiresSelection: false,
    });
  } else {
    exportActions.push({
      label: "Excel",
      icon: <FaFileExcel className="w-3.5 h-3.5 text-green-500 group-hover:text-white" />,
      onClick: handleNativeExportExcel,
      requiresSelection: false,
    });
  }

  const nativeActions: DataTableAction<T>[] = [];
  if (canDelete && onDelete) {
    nativeActions.push({
      label: "Excluir",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: (ids) => onDelete(ids),
    });
  }

  const allActions: DataTableAction<T>[] = [
    ...exportActions,
    ...nativeActions,
    ...actions,
  ];
  const showExportBar = exportActions.length > 0 && selectedIds.length === 0;

  // ============================================================
  // Ordenação (tri-state: asc → desc → none)
  // ============================================================
  const handleSort = (col: Column<T>) => {
    const field = col.sortKey || String(col.key);

    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc");
      return;
    }
    if (sortOrder === "asc") {
      setSortOrder("desc");
      return;
    }
    if (sortOrder === "desc") {
      setSortField(null);
      setSortOrder(null);
      return;
    }
    setSortOrder("asc");
  };

  // ============================================================
  // Estilos de célula
  // ============================================================
  const totalPages = Math.ceil(total / limit);

  const getCellStyle = (col: Column<T>): React.CSSProperties => {
    const style: React.CSSProperties = {};
    if (col.width) style.width = col.width;
    if (col.minWidth) style.minWidth = col.minWidth;
    if (col.nowrap) style.whiteSpace = "nowrap";
    if (col.align) style.textAlign = col.align;
    return style;
  };

  const getCellClassName = (col: Column<T>, item: T) => {
    const base = col.className;
    return typeof base === "function" ? base(item) : base || "";
  };

  // ============================================================
  // Render — Cards
  // ============================================================
  if (variant === "cards") {
    return (
      <div className="space-y-4">
        <div className="relative">
          {loading && data.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div
                className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${
                  loading ? "blur-sm opacity-60" : ""
                }`}
              >
                {filteredData.length === 0 && !loading ? (
                  <div className="col-span-full p-4 text-center text-muted">
                    Nenhum registro encontrado.
                  </div>
                ) : (
                  filteredData.map((item) => (
                    <div
                      key={toIdString(item._id)}
                      onClick={() => onRowClick?.(item)}
                      className="cursor-pointer"
                    >
                      {renderCard ? (
                        renderCard(item, extraData)
                      ) : (
                        <div>Card</div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {loading && data.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                  <LoaderCircle className="w-10 h-10 animate-spin text-brand" />
                </div>
              )}
            </>
          )}
        </div>

        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          selectable={selectable}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          onClearSelection={() => {
            setSelectedIds([]);
            setSelectAll(false);
          }}
          showExportBar={showExportBar}
          exportActions={exportActions}
          allActions={allActions}
        />
      </div>
    );
  }

  // ============================================================
  // Render — Tabela
  // ============================================================
  return (
    <div className="space-y-3">
      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        selectable={selectable}
        selectedIds={selectedIds}
        selectedItems={selectedItems}
        onClearSelection={() => {
          setSelectedIds([]);
          setSelectAll(false);
        }}
        showExportBar={showExportBar}
        exportActions={exportActions}
        allActions={allActions}
      />

      <div className="relative bg-elevated dark:bg-dark/20 border border-default dark:border-strong rounded-xl overflow-hidden shadow-sm hover:drop-shadow-lg">
        <table
          className="w-full text-sm text-left"
          style={{
            tableLayout: renderColumns.some((c) => c.width) ? "fixed" : "auto",
          }}
        >
          <thead
            ref={theadRef}
            className="bg-sunken text-muted dark:text-muted border-b border-default dark:border-strong"
          >
            <tr>
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
                .filter((col) => col.key !== "__select")
                .map((col) => (
                  <th
                    key={String(col.key)}
                    className={`group p-4 border-r hover:text-link last:border-none ${
                      col.sortable !== false ? "cursor-pointer" : ""
                    } font-medium ${col.headerClassName || ""}`}
                    style={getCellStyle(col)}
                    onClick={() => col.sortable !== false && handleSort(col)}
                  >
                    <span className="grid-cols-2 flex">
                      <span
                        className={`flex-1 grid-flow-col-dense ${
                          col.headerClassName || ""
                        }`}
                      >
                        {col.label}
                      </span>
                      <span className="w-4">
                        {col.sortable !== false &&
                        sortField === String(col.key) ? (
                          sortOrder === "asc" ? (
                            <ListSortAscending className="w-4 h-4" />
                          ) : (
                            <ListSortDescending className="w-4 h-4" />
                          )
                        ) : (
                          <span className="min-w-4 h-4 opacity-40 group-hover:opacity-100">
                            <ListChevronsUpDown className="w-4 h-4 text-muted" />
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                ))}
            </tr>
          </thead>

          {loading && data.length === 0 ? (
            <SkeletonTable columns={renderColumns} rows={limit} />
          ) : (
            <tbody
              className={`divide-y divide-apple-border-light dark:divide-apple-border-dark ${
                loading ? "blur-sm opacity-60" : ""
              }`}
            >
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={renderColumns.length}
                    className="p-4 text-center text-muted dark:text-muted"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr
                    key={toIdString(item._id)}
                    onClick={() => onRowClick?.(item)}
                    className={`hover:bg-page dark:hover:bg-surface border-sunken dark:border-surface transition-colors ${
                      index % 2 === 0 ? "bg-pagepobser dark:bg-elevated" : ""
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {selectable && (
                      <td
                        className="p-4 text-center"
                        style={getCellStyle(renderColumns[0])}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(
                            toIdString(item._id),
                          )}
                          onChange={() =>
                            toggleSelection(toIdString(item._id))
                          }
                          className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                        />
                      </td>
                    )}
                    {renderColumns
                      .filter((col) => col.key !== "__select")
                      .map((col) => (
                        <td
                          key={String(col.key)}
                          className={`p-4 ${getCellClassName(col, item)}`}
                          style={getCellStyle(col)}
                        >
                          {col.render
                            ? col.render(item, extraData)
                            : ((item as any)[col.key] as React.ReactNode)}
                        </td>
                      ))}
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>

        {loading && data.length > 0 && (
          <div
            className="absolute inset-x-0 bg-white/50 backdrop-blur-sm flex items-center justify-center"
            style={{ top: headerHeight, bottom: 0 }}
          >
            <LoaderCircle className="w-10 h-10 animate-spin text-brand" />
          </div>
        )}
      </div>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        selectable={selectable}
        selectedIds={selectedIds}
        selectedItems={selectedItems}
        onClearSelection={() => {
          setSelectedIds([]);
          setSelectAll(false);
        }}
        showExportBar={showExportBar}
        exportActions={exportActions}
        allActions={allActions}
      />
    </div>
  );
}