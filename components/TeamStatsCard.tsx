import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  BadgePlus,
  Eye,
  Maximize2,
  X,
  ShieldX,
  CalendarSync,
  FileStack,
  FileCode,
} from "lucide-react";
import SlideToggle from "./SlideToggle";
import { usePathname } from "next/navigation";
import { useSlideToggle } from "@/hooks/useLocalSettings";
import { createPortal } from "react-dom";

interface TeamStatsCardProps {
  type: "status" | "category";
  title: string;
  total: number;
  severity?: Record<string, number>;
  status?: Record<string, number>;
  category?: Record<string, number>;
  categoryGroup?: Record<string, number>;
  categoryDetails?: Record<string, Record<string, number>>;
  variant?: "default" | "compact";
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const SEVERITY_SHIELDS = [
  { key: "critical", letter: "C", color: "#ef4444", label: "Critical" },
  { key: "high", letter: "H", color: "#f97316", label: "High" },
  { key: "medium", letter: "M", color: "#eab308", label: "Medium" },
  { key: "low", letter: "L", color: "#22c55e", label: "Low" },
];

const CATEGORY_COLORS = [
  "#911eb4",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#e6194B",
  "#469990",
  "#dcbeff",
  "#9A6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#393b79",
  "#5254a3",
  "#6b6ecf",
  "#9c9ede",
  "#637939",
  "#8ca252",
  "#b5cf6b",
  "#cedb9c",
  "#8c6d31",
  "#bd9e39",
  "#e7ba52",
  "#e7cb94",
  "#843c39",
  "#ad494a",
  "#d6616b",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  open: { label: "Novo", icon: BadgePlus, color: "#007AFF", bg: "#dbeafe" },
  resolved: {
    label: "Corrigido",
    icon: CheckCircle2,
    color: "#10b981",
    bg: "#d1fae5",
  },
  recurring: {
    label: "Recorrente",
    icon: CalendarSync,
    color: "#ef4444",
    bg: "#fee2e2",
  },
  wont_fix: {
    label: "Não Corrigir",
    icon: ShieldX,
    color: "#000000",
    bg: "#f3f4f6",
  },
};

interface CategoryPopupProps {
  anchor: { top: number; left: number; right: number; bottom: number };
  categoryKey: string;
  value: number;
  viewMode: "grouped" | "single";
  details: Record<string, number>;
  popupRef: React.RefObject<HTMLDivElement | null>;
}

const POPUP_WIDTH = 384;
const POPUP_MARGIN = 12;

function CategoryPopup({
  anchor,
  categoryKey,
  value,
  viewMode,
  details,
  popupRef,
}: CategoryPopupProps) {
  const { top, left, right } = anchor;

  // Decide a posição horizontal: preferir alinhar com a esquerda do item.
  // Se estourar à direita, alinha à direita do item.
  // Se estourar em ambos, centraliza na viewport.
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  const spaceRight = viewportW - left;
  const spaceLeft = right;

  let horizontal: "left" | "right" | "center";
  if (spaceRight >= POPUP_WIDTH + POPUP_MARGIN) {
    horizontal = "left";
  } else if (spaceLeft >= POPUP_WIDTH + POPUP_MARGIN) {
    horizontal = "right";
  } else {
    horizontal = "center";
  }

  const style: React.CSSProperties = {
    position: "fixed",
    width: POPUP_WIDTH,
    zIndex: 9999,
  };

  // Vertical: abre acima do item por padrão; se não couber, abre abaixo
  const estimatedHeight = 320;
  const openBelow = top < estimatedHeight + POPUP_MARGIN;

  if (openBelow) {
    style.top = anchor.bottom + POPUP_MARGIN;
  } else {
    style.bottom = viewportH - top + POPUP_MARGIN;
  }

  if (horizontal === "left") {
    style.left = Math.max(POPUP_MARGIN, left);
  } else if (horizontal === "right") {
    style.right = Math.max(POPUP_MARGIN, viewportW - right);
  } else {
    style.left = "50%";
    style.transform = "translateX(-50%)";
  }

  const totalDetails = Object.values(details).reduce((a, b) => a + b, 0);

  return createPortal(
    <div
      ref={popupRef}
      style={style}
      className="bg-page border border-default dark:border-strong rounded-lg shadow-lg overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-default dark:border-strong">
        <h4 className="text-sm font-bold text-heading dark:text-heading">
          {categoryKey}
        </h4>
        <p className="text-xs text-muted">
          {value} {viewMode === "grouped" ? "grupos" : "observações"}
        </p>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {Object.entries(details)
          .sort((a, b) => b[1] - a[1])
          .map(([pattern, count], i) => (
            <div
              key={pattern}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                i % 2 === 0 ? "bg-page/80 dark:bg-surface/70" : ""
              }`}
            >
              <span className="truncate pr-2 text-muted dark:text-body">
                {pattern}
              </span>
              <span className="font-semibold text-heading dark:text-heading">
                {count}
              </span>
            </div>
          ))}
      </div>

      <div className="px-4 py-2 border-t border-default dark:border-strong flex justify-between items-center bg-page/30 dark:bg-surface/10">
        <span className="text-xs font-bold uppercase text-muted">Total</span>
        <span className="text-sm font-bold text-heading dark:text-heading">
          {totalDetails}
        </span>
      </div>
    </div>,
    document.body,
  );
}

export default function TeamStatsCard({
  type,
  title,
  total,
  severity,
  status,
  category,
  categoryGroup,
  categoryDetails,
  variant = "default",
}: TeamStatsCardProps) {
  const [activeCategory, setActiveCategory] = useState<{
    key: string;
    anchor: { top: number; left: number; right: number; bottom: number };
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const pathname = usePathname();
  const { value: viewMode, setValue: setViewMode } = useSlideToggle<
    "grouped" | "single"
  >(pathname, "teamStatsView", "grouped");

  useEffect(() => {
    if (!activeCategory) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (cardRef.current?.contains(target)) return;
      setActiveCategory(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeCategory]);

  const handleCategoryClick = (key: string, event: React.MouseEvent) => {
    event.stopPropagation();

    // Toggle: se clicou no mesmo, fecha
    if (activeCategory?.key === key) {
      setActiveCategory(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setActiveCategory({
      key,
      anchor: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
    });
  };

  // ===================== FUNÇÕES AUXILIARES =====================
  const severityBar = () => {
    const severityEntries = Object.entries(severity || {});
    if (severityEntries.length === 0)
      return (
        <div className="h-3 w-full bg-page dark:bg-surface rounded-full" />
      );
    return (
      <div className="flex h-4 w-full rounded-full overflow-hidden bg-page dark:bg-surface gap-1 transition-all">
        {severityEntries.map(([key, value]) => {
          const color = SEVERITY_COLORS[key] || "#e5e7eb";
          return (
            <div
              className="text-[12px] px-2 text-header/40"
              key={key}
              style={{ flexGrow: value, backgroundColor: color }}
            />
          );
        })}
      </div>
    );
  };

  const severityLegend = () => {
    return SEVERITY_SHIELDS.map(({ key, letter, color, label }) => (
      <div
        key={key}
        className="flex justify-between items-center gap-2"
        title={`${label}: ${severity?.[key] || 0}`}
      >
        <div className="relative w-5 h-6">
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full drop-shadow-sm hover:drop-shadow-lg"
          >
            <path
              d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
              fill={color}
            />
            <path
              d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
              fill="none"
              stroke="rgba(0,0,0,0.15)"
              strokeWidth="0.8"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-body font-bold text-[8px]">
            {letter}
          </span>
        </div>
        <span className="text-sm font-semibold text-heading dark:text-heading">
          {severity?.[key] || 0}
        </span>
      </div>
    ));
  };

  const renderStatusItem = (statusKey: string) => {
    const config = STATUS_CONFIG[statusKey] || {
      label: statusKey,
      icon: Eye,
      color: "#9ca3af",
      bg: "#f3f4f6",
    };
    const Icon = config.icon;
    const count = status?.[statusKey] || 0;

    return (
      <div className="flex flex-col items-start justify-center p-4 border-r last:border-r-0 border-subtle dark:border-strong hover:border-brand-subtle">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-6 h-6 flex items-center justify-center rounded-md"
            style={{ backgroundColor: config.bg }}
          >
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </span>
          <span className="text-sm font-medium text-heading dark:text-heading">
            {config.label}
          </span>
        </div>
        <div className="text-2xl font-bold text-heading dark:text-heading">
          {count}
        </div>
      </div>
    );
  };

  // ===================== CARD DE CATEGORIA =====================
  if (type === "category") {
    const categoryMap =
      viewMode === "grouped" ? categoryGroup || {} : category || {};
    const entries = Object.entries(categoryMap).sort();
    const totalItems = entries.reduce((sum, [, value]) => sum + value, 0);

    // 🔥 Limite de itens visíveis: 5 (para caber no card)
    const MAX_VISIBLE_ITEMS = 5;
    const hasMoreItems = entries.length > MAX_VISIBLE_ITEMS;
    const visibleEntries = hasMoreItems
      ? entries.slice(0, MAX_VISIBLE_ITEMS)
      : entries;

    const renderStackedBar = (map: Record<string, number>) => {
      const totalBar = Object.values(map).reduce((sum, val) => sum + val, 0);
      if (totalBar === 0)
        return (
          <div className="h-3 w-full bg-page dark:bg-surface rounded-full" />
        );
      return (
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-page dark:bg-surface gap-1">
          {Object.entries(map).map(([key, value], index) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div
                key={key}
                style={{
                  flexGrow: value,
                  backgroundColor: color,
                  filter: "saturate(60%)",
                }}
              />
            );
          })}
        </div>
      );
    };

    const modalMap =
      viewMode === "grouped" ? categoryGroup || {} : category || {};
    const modalEntries = Object.entries(modalMap).sort();

    return (
      <>
        <div
          ref={cardRef}
          className="bg-elevated border border-subtle dark:border-strong rounded-lg p-5 shadow-sm hover:drop-shadow-lg relative flex flex-col h-[280px] transition-all duration-300"
        >
          {/* Cabeçalho - Distribuição por Categoria*/}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-heading dark:text-heading truncate">
              {title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <SlideToggle
                options={[
                  {
                    key: "grouped",
                    label: "Grupo",
                    icon: FileStack,
                    activeClassName: "text-warning-600 dark:text-warning-300",
                  },
                  {
                    key: "single",
                    label: "Individual",
                    icon: FileCode,
                    activeClassName: "text-success-600 dark:text-success-300",
                  },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode(value)}
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-md transition-colors"
                title="Ver todas as categorias"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-heading dark:text-heading">
              {totalItems}
            </span>
            <span className="text-sm text-muted dark:text-muted">
              Observações
              {viewMode === "grouped" ? " agrupadas" : " individuais"}
            </span>
          </div>

          {/* Barra */}
          <div className="mt-4">{renderStackedBar(categoryMap)}</div>

          {/* Lista de categorias em grid 2 colunas, com limite de 5 itens + link "Ver todas" */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {visibleEntries.length === 0 ? (
              <div className="text-sm text-muted">Sem dados para exibir</div>
            ) : (
              <div className="grid grid-cols-2 gap-x-16 gap-y-1.5">
                {visibleEntries.map(([key, value], index) => {
                  const details = categoryDetails?.[key];
                  const hasDetails = details && Object.keys(details).length > 0;
                  const isActive = activeCategory?.key === key;

                  return (
                    <div key={key}>
                      <div
                        ref={itemRef}
                        className={`flex items-center gap-3 py-1 transition-colors ${
                          hasDetails ? "cursor-pointer" : "cursor-default"
                        } ${
                          isActive
                            ? "text-brand underline"
                            : "hover:text-brand hover:underline"
                        }`}
                        onClick={
                          hasDetails
                            ? (e) => handleCategoryClick(key, e)
                            : undefined
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="flex-1 text-xs truncate" title={key}>
                          {key}
                        </span>
                        <span className="font-semibold text-xs shrink-0">
                          {value}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* 🔥 6º slot: link "Ver todas" quando houver mais de 5 categorias */}
                {hasMoreItems && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex !items-left gap-3 p-0 py-2 text-left! hover:!text-success-500 hover:!bg-transparent"
                    title="Ver todas as categorias"
                  >
                    <Maximize2 className="w-3 h-3 mt-0.5" />
                    <span className="text-xs font-semibold">
                      Ver todas ({entries.length})
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {activeCategory &&
          categoryDetails?.[activeCategory.key] &&
          Object.keys(categoryDetails[activeCategory.key]).length > 0 && (
            <CategoryPopup
              anchor={activeCategory.anchor}
              categoryKey={activeCategory.key}
              value={(categoryMap[activeCategory.key] ?? 0) as number}
              viewMode={viewMode}
              details={categoryDetails[activeCategory.key]}
              popupRef={popupRef}
            />
          )}
        {/* 🔥 Modal de Detalhes com transição suave */}
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 transition-all duration-300 ${
            isModalOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`bg-surface border border-default dark:border-strong rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 ${
              isModalOpen ? "scale-100" : "scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 bg-sunken border-b border-default dark:border-strong">
              <h3 className="text-lg font-bold text-heading dark:text-heading">
                Distribuição por Categoria
              </h3>
              <div className="flex items-center gap-3">
                <SlideToggle
                  options={[
                    {
                      key: "grouped",
                      label: "Grupo",
                      icon: FileStack,
                      activeClassName: "text-warning-400 dark:text-warning",
                    },
                    {
                      key: "single",
                      label: "Individual",
                      icon: FileCode,
                      activeClassName: "text-success-400 dark:text-success",
                    },
                  ]}
                  value={viewMode}
                  onChange={(value) => setViewMode(value)}
                  width={200}
                  height={40}
                />
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-muted dark:text-muted" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-8">{renderStackedBar(modalMap)}</div>
              <div className="space-y-8">
                {modalEntries.length === 0 ? (
                  <div className="text-center text-muted py-10">
                    Sem dados para exibir
                  </div>
                ) : (
                  modalEntries.map(([cat, catTotal], index) => (
                    <div key={cat}>
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="text-base font-bold text-heading dark:text-heading">
                          {cat}
                        </span>
                        <span className="ml-auto text-lg font-bold text-heading dark:text-heading">
                          {catTotal}
                        </span>
                      </div>
                      {categoryDetails?.[cat] &&
                      Object.keys(categoryDetails[cat]).length > 0 ? (
                        <div className="ml-7 space-y-1 border-l border-default dark:border-strong pl-4">
                          {Object.entries(categoryDetails[cat])
                            .sort((a, b) => b[1] - a[1])
                            .map(([pattern, count]) => (
                              <div
                                key={pattern}
                                className="flex justify-between text-sm py-1"
                              >
                                <span className="text-muted dark:text-body truncate pr-4">
                                  {pattern}
                                </span>
                                <span className="font-semibold text-heading dark:text-heading shrink-0">
                                  {count}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="ml-7 text-sm text-muted">
                          Sem detalhes para esta categoria
                        </div>
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
  if (type === "status" && variant === "compact") {
    return (
      <div className="bg-elevated border border-sunken dark:border-strong rounded-lg p-5 shadow-sm hover:drop-shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-x-16 gap-6 items-center">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-heading dark:text-heading uppercase tracking-wide">
              {title}
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-heading dark:text-heading">
                {total}
              </span>
              <span className="text-xs text-muted dark:text-muted">
                Observações
              </span>
            </div>
            {severityBar()}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {severityLegend()}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-x-6">
            {["open", "resolved", "recurring", "wont_fix"].map((key) => {
              const config = STATUS_CONFIG[key] || {
                label: key,
                icon: Eye,
                color: "#9ca3af",
                bg: "#f3f4f6",
              };
              const Icon = config.icon;
              const count = status?.[key] || 0;
              return (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center p-4 py-6 rounded-lg bg-gradient dark:bg-surface text-center"
                >
                  <span
                    className="w-9 h-9 flex items-center justify-center rounded-lg mb-2"
                    style={{ backgroundColor: config.bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </span>
                  <span className="text-2xl font-bold text-heading dark:text-heading">
                    {count}
                  </span>
                  <span className="text-[10px] font-medium text-muted dark:text-muted mt-1">
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
    <div className="dark:bg-surface gap-0.5 border border-sunken dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg h-full flex flex-col">
      <div className="p-6 pb-4 bg-elevated shadow-md">
        <h3 className="text-lg font-semibold text-heading dark:text-heading">
          {title}
        </h3>
        <div className="mt-4">{severityBar()}</div>
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-heading dark:text-heading">
              {total}
            </span>
            <span className="text-sm text-muted dark:text-muted">
              Observações
            </span>
          </div>
          <div className="flex items-center gap-4">{severityLegend()}</div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-4 border-t-2 border-elevated dark:border-strong bg-surface">
        {renderStatusItem("open")}
        {renderStatusItem("resolved")}
        {renderStatusItem("recurring")}
        {renderStatusItem("wont_fix")}
      </div>
    </div>
  );
}
