// components/RangeSelector.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import {
  RANGE_PRESETS,
  DEFAULT_PRESET,
  getRangeShortLabel,
  getRangeLongLabel,
  type RangePreset,
} from "@/lib/range-options";
import { useRangeState } from "@/hooks/useRangeState";

/** ISO → `YYYY-MM-DDTHH:mm` (aceito por `datetime-local`). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function RangeSelector() {
  const { state, setState, reset } = useRangeState();

  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const shortLabel = getRangeShortLabel(state);
  const longLabel = getRangeLongLabel(state);

  // Posiciona/reposiciona popover
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopoverPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  // Fecha em clique fora / Esc
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(t) &&
        buttonRef.current &&
        !buttonRef.current.contains(t)
      ) {
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

  // Prefill custom ao abrir
  useEffect(() => {
    if (!open) return;
    if (state.mode === "custom" && state.from && state.to) {
      setCustomFrom(toLocalInput(state.from));
      setCustomTo(toLocalInput(state.to));
    }
  }, [open, state.mode, state.from, state.to]);

  const handlePreset = (preset: RangePreset) => {
    setState({ mode: "preset", preset });
    setOpen(false);
    setError(null);
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) {
      setError("Preencha as duas datas.");
      return;
    }
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError("Datas inválidas.");
      return;
    }
    if (from >= to) {
      setError("A data inicial deve ser anterior à final.");
      return;
    }
    setState({
      mode: "custom",
      preset: DEFAULT_PRESET,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={longLabel}
        className="flex items-center gap-1.5 bg-elevated border border-default dark:border-strong rounded-lg px-2.5 py-1.5 text-xs font-medium text-heading hover:border-brand transition-colors whitespace-nowrap"
      >
        <CalendarRange className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="max-w-[120px] truncate">{shortLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Janela temporal"
            className="fixed z-[9999] w-72 bg-sunken border border-default dark:border-strong rounded-lg shadow-xl"
            style={{ top: popoverPos.top, right: popoverPos.right }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-default">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Janela temporal
              </span>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
                className="text-[11px] text-muted hover:text-brand transition-colors"
              >
                Resetar
              </button>
            </div>

            <ul className="py-1">
              {RANGE_PRESETS.map((p) => {
                const active =
                  state.mode === "preset" && state.preset === p.value;
                return (
                  <li key={p.value}>
                    <button
                      type="button"
                      onClick={() => handlePreset(p.value)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "text-brand font-medium bg-brand/5"
                          : "text-heading hover:bg-elevated"
                      }`}
                    >
                      <span>{p.label}</span>
                      {active && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-default px-3 py-3">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Personalizado
              </span>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-[10px] text-muted">
                  De
                  <input
                    type="datetime-local"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-2 py-1 rounded-md bg-elevated border border-default text-xs text-heading outline-none focus:border-brand"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-muted">
                  Até
                  <input
                    type="datetime-local"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-2 py-1 rounded-md bg-elevated border border-default text-xs text-heading outline-none focus:border-brand"
                  />
                </label>
              </div>
              {error && (
                <p className="mt-2 text-[10px] text-red-400">{error}</p>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1 rounded-md text-xs text-muted hover:text-heading"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!customFrom || !customTo}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-brand text-white hover:opacity-90 disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
