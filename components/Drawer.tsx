"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  header?: ReactNode;
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  side?: "right" | "left";
  className?: string;
  hideCloseButton?: boolean;
}

const MAX_WIDTH_CLASS: Record<NonNullable<DrawerProps["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export default function Drawer({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  headerActions,
  header,
  maxWidth = "2xl",
  side = "right",
  className = "",
  hideCloseButton = false,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  // Só monta o portal no client (evita erro de hidratação em SSR).
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC fecha
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!mounted) return null;

  const closedTransform =
    side === "right" ? "translate-x-full" : "-translate-x-full";
  const justify = side === "right" ? "justify-end" : "justify-start";
  const borderSide = side === "right" ? "border-l" : "border-r";

  const hasStandardHeader =
    title !== undefined ||
    subtitle !== undefined ||
    headerActions !== undefined;

  const closeButton = !hideCloseButton ? (
    <button
      type="button"
      onClick={onClose}
      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/5 transition-colors"
      aria-label="Fechar"
    >
      <X className="w-5 h-5" />
    </button>
  ) : null;

  const showHeader =
    header !== undefined || hasStandardHeader || closeButton !== null;

  const content = (
    <div
      className={`fixed inset-0 z-[9999] flex ${justify} ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${MAX_WIDTH_CLASS[maxWidth]} h-screen overflow-y-auto ${borderSide} border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : closedTransform
        } ${className}`}
      >
        {showHeader && (
          <div className="sticky top-0 z-10 bg-[#0d1117]/95 backdrop-blur border-b border-gray-800">
            {header !== undefined ? (
              <div className="relative">
                {header}
                {closeButton && (
                  <div className="absolute top-4 left-4">{closeButton}</div>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 className="text-lg font-semibold text-white truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {headerActions}
                  {closeButton}
                </div>
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
