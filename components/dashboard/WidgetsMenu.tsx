// components/dashboard/WidgetsMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  SlidersHorizontal,
  RotateCcw,
  Save,
  SaveAll,
} from "lucide-react";
import type { OrderedWidget, WidgetSpan } from "@/hooks/useDashboardLayout";
import HeaderActions from "../PageHeader/HeaderActions";

interface WidgetsMenuProps {
  /** Lista completa — visíveis **e** ocultos. */
  widgets: OrderedWidget[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onSpanChange: (id: string, span: WidgetSpan) => void;
  onReset: () => void;

  // ---------- Contexto de salvamento ----------
  /** Nome do perfil ativo, ou `null` quando em modo "layout local". */
  activeProfileName?: string | null;
  /** True quando o perfil ativo tem edições pendentes. */
  isDirty?: boolean;
  /** Persiste o draft no perfil ativo. Só chamado quando `isDirty`. */
  onSave?: () => void;
  /** Abre o modal "Salvar como novo perfil" com o estado atual. */
  onSaveAs?: () => void;
  /** True enquanto um save está em andamento. */
  saving?: boolean;
}

/**
 * Popover de personalização de widgets.
 *
 * Layout de linhas:
 *  - Seção "habilitados" (ordem corrente).
 *  - Divisor.
 *  - Seção "desabilitados" (ordem preservada).
 *
 * Rodapé (novo): ações de salvamento contextualizadas.
 *  - Modo local: apenas "Salvar como…" (layout local é auto-salvo).
 *  - Modo perfil com edições: "Salvar" + "Salvar como…".
 *  - Modo perfil sem edições: "Salvar como…" com aviso de tudo salvo.
 *
 * Toda a operação de salvar acontece **dentro deste menu**. O usuário
 * não precisa fechar, procurar um segundo menu, nem notar indicadores
 * externos.
 */
export default function WidgetsMenu({
  widgets,
  onToggle,
  onMove,
  onSpanChange,
  onReset,
  activeProfileName = null,
  isDirty = false,
  onSave,
  onSaveAs,
  saving = false,
}: WidgetsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const enabledWidgets = widgets.filter((w) => w.visible);
  const disabledWidgets = widgets.filter((w) => !w.visible);

  const renderRow = (
    w: OrderedWidget,
    index: number,
    list: OrderedWidget[],
  ) => {
    const isFirst = index === 0;
    const isLast = index === list.length - 1;

    return (
      <li
        key={w.id}
        className="flex items-center gap-2 px-2 py-2 hover:bg-elevated/60 transition-colors"
      >
        <div className="flex flex-col shrink-0 -my-1">
          <button
            type="button"
            onClick={() => onMove(w.id, "up")}
            disabled={isFirst}
            title="Mover para cima"
            aria-label="Mover para cima"
            className="p-0.5 text-muted hover:text-brand disabled:opacity-25 rounded"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(w.id, "down")}
            disabled={isLast}
            title="Mover para baixo"
            aria-label="Mover para baixo"
            className="p-0.5 text-muted hover:text-brand disabled:opacity-25 rounded"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        <span
          className={`flex-1 min-w-0 truncate text-xs ${
            w.visible ? "text-heading" : "text-muted"
          }`}
          title={w.label}
        >
          {w.label}
        </span>

        {w.allowSpanEdit === false ? (
          <span
            className="shrink-0 text-[10px] text-muted italic pr-2"
            title="Este widget usa largura total"
          >
            Largura total
          </span>
        ) : (
          <div
            className={`inline-flex items-center gap-0.5 p-0.5 rounded-md bg-default/20 border border-default/40 shrink-0 ${
              w.visible ? "" : "opacity-40"
            }`}
            role="group"
            aria-label="Largura"
          >
            {w.allowedSpans.map((span) => {
              const active = w.span === span;
              return (
                <button
                  key={span}
                  type="button"
                  onClick={() => onSpanChange(w.id, span)}
                  disabled={!w.visible}
                  title={`Largura ${span}/6`}
                  aria-label={`Largura ${span}/6`}
                  aria-pressed={active}
                  className={`flex items-center gap-[1.5px] px-1.5 py-1 rounded transition-all disabled:cursor-not-allowed ${
                    active ? "bg-brand shadow-sm" : "hover:bg-default/40"
                  }`}
                >
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <span
                      key={i}
                      className={`w-[2px] h-3 rounded-sm transition-colors ${
                        i <= span
                          ? active
                            ? "bg-white"
                            : "bg-heading/70"
                          : active
                            ? "bg-white/25"
                            : "bg-heading/15"
                      }`}
                    />
                  ))}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={w.visible}
          onClick={() => onToggle(w.id)}
          title={w.visible ? "Ocultar widget" : "Mostrar widget"}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            w.visible ? "bg-brand" : "bg-default/60"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              w.visible ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </li>
    );
  };

  const hasProfile = Boolean(activeProfileName);
  const canSaveToProfile = hasProfile && isDirty && Boolean(onSave);

  const handleSaveAs = () => {
    if (!onSaveAs) return;
    // Fecha o menu ANTES de abrir o modal — evita dois popovers sobrepostos
    setOpen(false);
    onSaveAs();
  };

  return (
    <div ref={rootRef} className="relative">
      <HeaderActions
        tooltip={"Personalizar widgets"}
        color="orange"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        isActive={open}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {/* Ponto discreto sinalizando que há edições pendentes */}
        {isDirty && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warning-500" />
        )}
      </HeaderActions>

      {open && (
        <div
          role="dialog"
          aria-label="Widgets do Dashboard"
          className="absolute right-0 mt-2 w-[380px] bg-sunken border border-default rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-default">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Widgets
            </span>
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] text-muted hover:text-brand flex items-center gap-1"
              title="Restaurar layout padrão"
            >
              <RotateCcw className="w-3 h-3" />
              Restaurar
            </button>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            <ul className="py-1">
              {enabledWidgets.length === 0 ? (
                <li className="px-3 py-3 text-[11px] text-muted italic">
                  Nenhum widget habilitado.
                </li>
              ) : (
                enabledWidgets.map((w, i) => renderRow(w, i, enabledWidgets))
              )}
            </ul>

            {disabledWidgets.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-elevated/40 border-y border-default">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                  Desabilitados
                </span>
                <span className="text-[10px] text-muted/70 font-mono">
                  ({disabledWidgets.length})
                </span>
                <span className="flex-1 h-px bg-default/40" />
              </div>
            )}

            {disabledWidgets.length > 0 && (
              <ul className="py-1 opacity-80">
                {disabledWidgets.map((w, i) =>
                  renderRow(w, i, disabledWidgets),
                )}
              </ul>
            )}
          </div>

          {/* ---------- Rodapé: ações de salvamento ---------- */}
          {(onSave || onSaveAs) && (
            <div className="border-t border-default px-3 py-2.5 bg-elevated/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] text-muted leading-snug">
                  {hasProfile ? (
                    canSaveToProfile ? (
                      <>
                        Editando{" "}
                        <strong className="text-warning-600 dark:text-warning-400">
                          {activeProfileName}
                        </strong>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-success" />
                        Tudo salvo em{" "}
                        <strong className="text-heading">
                          {activeProfileName}
                        </strong>
                      </span>
                    )
                  ) : (
                    "Layout local (auto-salvo no navegador)"
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {canSaveToProfile && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 btn-primary disabled:opacity-50"
                    title={`Salvar alterações em ${activeProfileName}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                )}

                {onSaveAs && (
                  <button
                    type="button"
                    onClick={handleSaveAs}
                    disabled={saving}
                    className={`flex items-center justify-center gap-1.5 ${
                      canSaveToProfile ? "btn-secondary" : "btn-primary flex-1"
                    } disabled:opacity-50`}
                    title="Salvar este layout como um novo perfil"
                  >
                    <SaveAll className="w-3.5 h-3.5" />
                    Salvar como…
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
