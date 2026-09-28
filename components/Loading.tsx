// components/Loading.tsx
"use client";

import { Loader2 } from "lucide-react";

interface LoadingProps {
  /**
   * Rótulo opcional abaixo do spinner.
   * Quando omitido, mostra apenas o spinner.
   */
  label?: string;
  /** `fullscreen` cobre a viewport inteira. `panel` cobre o container. */
  variant?: "panel" | "fullscreen";
}

/**
 * Estado de carregamento padrão da aplicação.
 *
 * Uso:
 *  - `<Loading />`            → spinner centrado no container
 *  - `<Loading label="…" />`  → com texto
 *  - `<Loading variant="fullscreen" />` → overlay sobre a viewport
 */
export default function Loading({ label, variant = "panel" }: LoadingProps) {
  const isFullscreen = variant === "fullscreen";

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isFullscreen
          ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-page/80 backdrop-blur-sm"
          : "flex flex-col items-center justify-center gap-3 py-16"
      }
    >
      <Loader2 className="w-8 h-8 animate-spin text-brand" />
      {label && <p className="text-xs font-medium text-muted">{label}</p>}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
