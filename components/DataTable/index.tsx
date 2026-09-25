// components/DataTable.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
import { TableToolbar, TablePagination } from "../PaginationInfo";
import type { Types } from "mongoose";

// ============================================================
// Tipos
// ============================================================

/**
 * Sub-coluna apenas para exportação em Excel. Uma coluna com
 * `excelSubColumns` é renderizada como 1 coluna no PDF/tela, mas
 * "explode" em N colunas no Excel (permite filtrar por cada sub-valor).
 */
export interface ExcelSubColumn<T> {
  label: string;
  /** Largura em px (opcional). Convertida para a unidade do Excel. */
  width?: number;
  render: (item: T, extraData?: Record<string, any>) => any;
  /** Renderizador opcional para rich text / fill / bordas. */
  excelCellRenderer?: (
    cell: any,
    item: T,
    extraData?: Record<string, any>,
  ) => void;
}

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
  /**
   * Renderizador vetorial para PDF. Recebe `(doc, cell, item, extraData)`
   * e desenha o conteúdo manualmente (shields, badges, ícones).
   */
  pdfCellRenderer?: (
    doc: any,
    cell: any,
    item: T,
    extraData?: Record<string, any>,
  ) => void;
  /**
   * Renderizador de célula no Excel. Recebe o `Cell` do ExcelJS já
   * posicionado — permite escrever rich text, aplicar fills, borders.
   */
  excelCellRenderer?: (
    cell: any,
    item: T,
    extraData?: Record<string, any>,
  ) => void;

  /**
   * 🔑 Quando presente, o Excel ignora `excelCellRenderer` e expande
   *    esta coluna em N colunas filhas. O PDF continua renderizando
   *    como uma única coluna (usando `pdfCellRenderer`).
   */
  excelSubColumns?: ExcelSubColumn<T>[];
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
  rowSelectable?: (item: T) => boolean;
  actions?: DataTableAction<T>[];
  canDelete?: boolean;
  onDelete?: (selectedIds: string[], selectedItems: T[]) => void;
  exportPDF?: boolean;
  /** Orientação do PDF exportado. Default: "portrait". */
  exportOrientation?: "portrait" | "landscape";
  /** Orientação do Excel exportado. Default: "landscape" (A4). */
  excelOrientation?: "portrait" | "landscape";
  pdfTitle?: string;
  onExportPDF?: (filters: ExportFilters) => void;
  onExportExcel?: (filters: ExportFilters) => void;
  onSelectionChange?: (ids: string[]) => void;
  variant?: "table" | "cards";
  renderCard?: (item: T, extraData?: Record<string, any>) => React.ReactNode;
  extraData?: Record<string, any>;
  searchDbqlId?: string;
  /** Preset de range. Ignorado quando `rangeFrom` + `rangeTo` são passados. */
  range?: string;
  /** ISO. Deve vir com `rangeTo`. */
  rangeFrom?: string;
  /** ISO. Deve vir com `rangeFrom`. */
  rangeTo?: string;
  filterColumn?: string | null;
  filterValue?: string;
  filterFunction?: (item: T) => boolean;
  /** Chave de persistência da preferência de view. Default: `datatable:viewMode:${endpoint}` */
  storageKey?: string;
}

// ============================================================
// Helpers
// ============================================================
function toIdString(id: string | Types.ObjectId): string {
  return typeof id === "string" ? id : id.toString();
}

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
        <tr key={index} className="border-b border-sunken dark:border-page">
          {columns.map((col, colIndex) => (
            <td key={colIndex} className="p-4">
              <div
                className="h-4 bg-sunken dark:bg-strong rounded animate-pulse"
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
  selectable = false,
  rowSelectable,
  actions = [],
  canDelete = true,
  onDelete,
  exportPDF = true,
  exportOrientation = "portrait",
  excelOrientation = "landscape",
  pdfTitle,
  onExportPDF,
  onExportExcel,
  variant = "table",
  renderCard,
  extraData,
  onSelectionChange,
  searchDbqlId = "",
  range,
  rangeFrom,
  rangeTo,
  filterColumn = null,
  filterValue = "",
  filterFunction,
  storageKey,
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
  // View mode (tabela ↔ cards)
  // ============================================================
  const [currentVariant, setCurrentVariant] = useState<"table" | "cards">(
    variant,
  );
  const viewModeKey = storageKey ?? `datatable:viewMode:${endpoint}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(viewModeKey);
      if (stored === "table" || stored === "cards") {
        setCurrentVariant(stored);
      }
    } catch {
      // localStorage indisponível — ignora
    }
  }, [viewModeKey]);

  const handleViewModeChange = (mode: "table" | "cards") => {
    setCurrentVariant(mode);
    try {
      window.localStorage.setItem(viewModeKey, mode);
    } catch {
      // ignora
    }
  };

  // ============================================================
  // Seleção
  // ============================================================
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
    setSelectAll(false);
  };

  // ============================================================
  // Dados filtrados
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

  const selectableItems = useMemo(
    () => (rowSelectable ? filteredData.filter(rowSelectable) : filteredData),
    [filteredData, rowSelectable],
  );

  const allSelectableChecked =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(toIdString(item._id)));

  const toggleSelectAll = () => {
    if (selectableItems.length === 0) return;

    if (allSelectableChecked) {
      const idsToRemove = new Set(
        selectableItems.map((item) => toIdString(item._id)),
      );
      setSelectedIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    } else {
      const idsToAdd = selectableItems.map((item) => toIdString(item._id));
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
    setSelectAll(!selectAll);
  };

  // ============================================================
  // Colunas
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
      });
    }
    return [...cols, ...columns];
  }, [selectable, columns]);

  // ============================================================
  // Medir altura do header
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
  // Fetch
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
          ...(range && { range }),
        });
        if (sortField) params.set("sort", sortField);
        if (sortOrder) params.set("order", sortOrder);
        if (searchDbqlId) params.set("q", searchDbqlId);

        const endpointURL = buildEndpointUrl(endpoint, params);
        console.log("[endpointURL]: {0}", endpointURL);
        const res = await fetch(endpointURL);
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
    searchDbqlId,
    range,
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
      if (range) params.set("range", range);
      if (rangeFrom && rangeTo) {
        params.set("from", rangeFrom);
        params.set("to", rangeTo);
      }
      if (sortField) params.set("sort", sortField);
      if (sortOrder) params.set("order", sortOrder);
      if (searchDbqlId) params.set("q", searchDbqlId);

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

  // ============================================================
  // Colunas para PDF (não expande sub-colunas)
  // ============================================================
  const buildPDFColumns = () =>
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
        pdfCellRenderer: col.pdfCellRenderer
          ? (doc: any, cell: any, item: any) =>
              col.pdfCellRenderer!(doc, cell, item, extraData)
          : undefined,
      }));

  // ============================================================
  // Colunas para Excel (expande `excelSubColumns`)
  // ============================================================
  interface BuiltExcelColumn {
    key: string;
    label: string;
    width?: string;
    render?: (item: any) => any;
    excelCellRenderer?: (cell: any, item: any) => void;
  }

  const buildExcelColumns = (): BuiltExcelColumn[] => {
    const out: BuiltExcelColumn[] = [];

    const baseColumns = columns
      .filter((col) => col.key !== "__select" && col.exportable !== false)
      .filter((col) => {
        const key = String(col.key).toLowerCase();
        return key !== "actions" && !key.includes("action");
      });

    baseColumns.forEach((col) => {
      // 🔑 Expansão em sub-colunas
      if (col.excelSubColumns && col.excelSubColumns.length > 0) {
        col.excelSubColumns.forEach((sub, idx) => {
          out.push({
            key: `${String(col.key)}.${idx}`,
            label: sub.label,
            width: sub.width ? `${sub.width}px` : undefined,
            render: (item: any) => sub.render(item, extraData),
            excelCellRenderer: sub.excelCellRenderer
              ? (cell: any, item: any) =>
                  sub.excelCellRenderer!(cell, item, extraData)
              : undefined,
          });
        });
        return;
      }

      // Coluna normal (1:1)
      out.push({
        key: String(col.key),
        label: col.label,
        width: col.width,
        render: col.render
          ? (item: any) => col.render!(item, extraData)
          : undefined,
        excelCellRenderer: col.excelCellRenderer
          ? (cell: any, item: any) =>
              col.excelCellRenderer!(cell, item, extraData)
          : undefined,
      });
    });

    return out;
  };

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
      columns: buildExcelColumns(),
      data: finalData,
      filename: safeFilename,
      orientation: excelOrientation,
      extraData,
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
      columns: buildPDFColumns(),
      data: finalData,
      filename: safeFilename,
      orientation: exportOrientation,
      extraData,
    });
  };

  // ============================================================
  // Ações
  // ============================================================
  const exportActions: DataTableAction<T>[] = [];

  if (onExportPDF) {
    exportActions.push({
      label: "PDF",
      icon: <FaFilePdf className="w-3.5 h-3.5 text-red-600" />,
      onClick: () => onExportPDF({ projectId }),
      requiresSelection: false,
    });
  } else if (exportPDF !== false) {
    exportActions.push({
      label: "PDF",
      icon: <FaFilePdf className="w-3.5 h-3.5 text-red-600" />,
      onClick: handleNativeExportPDF,
      requiresSelection: false,
    });
  }

  if (onExportExcel) {
    exportActions.push({
      label: "Excel",
      icon: <FaFileExcel className="w-3.5 h-3.5 text-green-500" />,
      onClick: () => onExportExcel({ projectId }),
      requiresSelection: false,
    });
  } else {
    exportActions.push({
      label: "Excel",
      icon: <FaFileExcel className="w-3.5 h-3.5 text-green-500" />,
      onClick: handleNativeExportExcel,
      requiresSelection: false,
    });
  }

  const nativeActions: DataTableAction<T>[] = [];
  if (canDelete && onDelete) {
    nativeActions.push({
      label: "Excluir",
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: (ids, items) => onDelete(ids, items),
      requiresSelection: true,
    });
  }

  const bulkActions: DataTableAction<T>[] = [
    ...nativeActions,
    ...actions.map((a) => ({ ...a, requiresSelection: true })),
  ];

  // ============================================================
  // Ordenação
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
  // Estilos
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
  if (currentVariant === "cards") {
    return (
      <div className="space-y-3">
        <TableToolbar
          currentPage={page}
          totalItems={total}
          pageSize={limit}
          pageSizeOptions={[5, 10, 25, 50, 100]}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          exportActions={exportActions}
          viewMode={currentVariant}
          onViewModeChange={
            typeof renderCard === "function" ? handleViewModeChange : undefined
          }
        />

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
          pageSize={limit}
          onPageChange={setPage}
          selectable={selectable}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          onClearSelection={() => {
            setSelectedIds([]);
            setSelectAll(false);
          }}
          bulkActions={bulkActions}
        />
      </div>
    );
  }

  // ============================================================
  // Render — Tabela
  // ============================================================
  return (
    <div className="space-y-3">
      <TableToolbar
        currentPage={page}
        totalItems={total}
        pageSize={limit}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        exportActions={exportActions}
        viewMode={currentVariant}
        onViewModeChange={
          typeof renderCard === "function" ? handleViewModeChange : undefined
        }
      />

      <div className="relative bg-page border border-sunken dark:border-page rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg">
        <table
          className="w-full text-sm text-left"
          style={{
            tableLayout: renderColumns.some((c) => c.width) ? "fixed" : "auto",
          }}
        >
          <thead
            ref={theadRef}
            className="bg-elevated dark:bg-sunken text-subtle border-b border-sunken dark:border-page"
          >
            <tr>
              {selectable && (
                <th
                  className="p-4 w-10 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={toggleSelectAll}
                    disabled={selectableItems.length === 0}
                    title={
                      selectableItems.length === 0
                        ? "Nenhum item selecionável nesta página"
                        : allSelectableChecked
                          ? "Desmarcar todos"
                          : "Selecionar todos os itens editáveis"
                    }
                    className="w-4 h-4 rounded border border-sunken dark:border-strong text-brand disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </th>
              )}
              {renderColumns
                .filter((col) => col.key !== "__select")
                .map((col) => (
                  <th
                    key={String(col.key)}
                    className={`group p-4 border-r border-sunken dark:border-page hover:text-link last:border-none ${
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
                          col.sortable && (
                            <span className="min-w-4 h-4 opacity-40 group-hover:opacity-100">
                              <ListChevronsUpDown className="w-4 h-4 text-muted" />
                            </span>
                          )
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
              className={`divide-y ${loading ? "blur-sm opacity-60" : ""}`}
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
                    className={`hover:bg-sunken border-b border-page dark:border-strong transition-colors ${
                      index % 2 === 0 ? "bg-surface" : "bg-elevated"
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {selectable && (
                      <td
                        className="p-4 text-center"
                        style={getCellStyle(renderColumns[0])}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(toIdString(item._id))}
                          onChange={() => toggleSelection(toIdString(item._id))}
                          disabled={
                            rowSelectable ? !rowSelectable(item) : false
                          }
                          title={
                            rowSelectable && !rowSelectable(item)
                              ? "Você só pode selecionar itens criados por você"
                              : undefined
                          }
                          className="w-4 h-4 rounded border-sunken dark:border-strong text-brand focus:ring-brand disabled:opacity-30 disabled:cursor-not-allowed"
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
        pageSize={limit}
        onPageChange={setPage}
        selectable={selectable}
        selectedIds={selectedIds}
        selectedItems={selectedItems}
        onClearSelection={() => {
          setSelectedIds([]);
          setSelectAll(false);
        }}
        bulkActions={bulkActions}
      />
    </div>
  );
}
