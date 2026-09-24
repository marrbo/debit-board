// components/DataTable/ExportSplitButton.tsx
"use client";

import {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronDown } from "lucide-react";

export interface ExportOption {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

interface ExportSplitButtonProps {
  options: ExportOption[];
  /**
   * Texto exibido no botão principal. O `label` da opção primária
   * aparece apenas no dropdown; para leitores de tela o botão principal
   * é anunciado como "Exportar como <label>".
   */
  primaryLabel?: string;
  /**
   * Índice da opção acionada pelo botão principal. Default: 0 (primeira).
   */
  primaryIndex?: number;
}

export default function ExportSplitButton({
  options,
  primaryLabel = "Exportar",
  primaryIndex = 0,
}: ExportSplitButtonProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  if (options.length === 0) return null;

  const primary = options[primaryIndex] ?? options[0];
  const allDisabled = options.every((o) => o.disabled);

  // ------------------------------------------------------------
  // Fecha ao clicar fora
  // ------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Reset do índice ao fechar
  useEffect(() => {
    if (!open) setFocusedIndex(-1);
  }, [open]);

  // Move foco para o item quando `focusedIndex` muda
  useEffect(() => {
    if (open && focusedIndex >= 0) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [open, focusedIndex]);

  // ------------------------------------------------------------
  // Ações
  // ------------------------------------------------------------
  const closeAndReturnFocus = useCallback(() => {
    setOpen(false);
    // Devolve foco ao chevron depois que o menu some do DOM
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const handlePrimaryClick = async () => {
    if (primary?.disabled) return;
    await primary?.onClick();
  };

  const handleOptionClick = async (opt: ExportOption) => {
    if (opt.disabled) return;
    closeAndReturnFocus();
    await opt.onClick();
  };

  // ------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------
  const handleTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setFocusedIndex(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setFocusedIndex(options.length - 1);
    }
  };

  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeAndReturnFocus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      case "Tab":
        // Deixa o browser mover o foco naturalmente; só fecha o menu
        setOpen(false);
        break;
    }
  };

  // ------------------------------------------------------------
  // Apenas uma opção — botão simples (sem split, sem menu)
  // ------------------------------------------------------------
  if (options.length === 1) {
    return (
      <button
        type="button"
        onClick={handlePrimaryClick}
        disabled={primary.disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label={`Exportar como ${primary.label}`}
        title={`Exportar como ${primary.label}`}
      >
        {primary.icon}
        <span>{primaryLabel}</span>
      </button>
    );
  }

  // ------------------------------------------------------------
  // Split button (2+ opções)
  // ------------------------------------------------------------
  return (
    <div className="relative flex items-center" ref={containerRef}>
      <div className="flex items-stretch rounded-md overflow-hidden">
        {/* Botão principal — visualmente "Exportar", ação = PDF */}
        <button
          type="button"
          onClick={handlePrimaryClick}
          disabled={primary?.disabled}
          className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-medium text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:bg-brand/10 focus-visible:text-brand"
          aria-label={`Exportar como ${primary?.label}`}
          title={`Exportar como ${primary?.label}`}
        >
          {primary?.icon}
          <span>{primaryLabel}</span>
        </button>

        {/* Divisor vertical */}
        <span
          aria-hidden
          className="w-px my-1 bg-strong/50 dark:bg-strong/40"
        />

        {/* Chevron — abre o menu */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={handleTriggerKeyDown}
          disabled={allDisabled}
          className="flex items-center justify-center px-1.5 text-muted hover:text-brand hover:bg-brand/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:bg-brand/10 focus-visible:text-brand"
          aria-label="Mais opções de exportação"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          title="Mais opções de exportação"
        >
          <ChevronDown
            aria-hidden
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Menu */}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Opções de exportação"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full mt-1 w-44 bg-surface dark:bg-[#1C1C1E] border border-sunken dark:border-strong rounded-md shadow-lg p-1 z-50"
        >
          {options.map((opt, idx) => (
            <button
              key={`${opt.label}-${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              role="menuitem"
              type="button"
              tabIndex={-1}
              onClick={() => handleOptionClick(opt)}
              disabled={opt.disabled}
              className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs font-medium text-muted hover:text-brand hover:bg-brand/10 focus:outline-none focus-visible:bg-brand/10 focus-visible:text-brand rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
