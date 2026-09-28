// components/dashboard/DashboardProfileBar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  LayoutDashboard,
  LayoutList,
  Settings,
  Star,
} from "lucide-react";
import HeaderActions from "@/components/PageHeader/HeaderActions";
import { useDashboardProfiles } from "@/hooks/useDashboardProfiles";
import { useLocalSettings } from "@/hooks/useLocalSettings";

/**
 * Dropdown compacto de layouts de Dashboard.
 *
 * Estado do Layout ativo vive em `localStorage` (`dashboardProfileId`)
 * — não em query string. A URL fica limpa e a seleção sobrevive a
 * reload sem poluir links compartilhados.
 *
 * Ações de edição (salvar / salvar como) ficam no `WidgetsMenu`.
 * O botão usa `HeaderActions` (ícone puro, tooltip abaixo, cor de
 * hover, `isActive` para esconder o tooltip enquanto o popover está
 * aberto).
 */
export default function DashboardProfileBar() {
  const { settings, update } = useLocalSettings();
  const { profiles, favorite } = useDashboardProfiles();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeId = settings.dashboardProfileId;
  const active = profiles.find((p) => p._id.toString() === activeId) ?? null;

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

  const handleSelect = (id: string | null) => {
    update({ dashboardProfileId: id });
    setOpen(false);
  };

  const favoriteFirst = [...profiles].sort((a, b) => {
    const aF = a.favorites.includes(a.sub) ? 0 : 1;
    const bF = b.favorites.includes(b.sub) ? 0 : 1;
    return aF - bF;
  });

  const tooltip = active
    ? `Layout: ${active.name}`
    : "Layout local (navegador)";

  return (
    <div ref={rootRef} className="relative">
      <HeaderActions
        onClick={() => setOpen((v) => !v)}
        tooltip={tooltip}
        color="brand"
        isActive={open}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-0.5">
          <LayoutDashboard size={14} />
          {/* <ChevronDown
            className={`w-3 h-3 text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          /> */}
        </span>
      </HeaderActions>

      {open && (
        <div
          role="dialog"
          aria-label="Layouts de dashboard"
          className="absolute right-0 mt-2 w-72 bg-elevated border border-default rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <div className="flex items-center bg-sunken justify-between px-3 py-2 border-b border-default">
            <span className="text-[12px] font-semibold flex items-center gap-1 text-muted uppercase tracking-wider">
              <LayoutList size={10} /> Layouts de Dashboard
            </span>
            <Link
              href="/settings/dashboards"
              onClick={() => setOpen(false)}
              aria-label="Gerenciar Layouts"
              title="Gerenciar Layouts"
              className="text-[11px] text-muted hover:text-brand flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
            </Link>
          </div>

          <ul className="py-1 max-h-72 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs ${
                  !active
                    ? "text-brand font-medium bg-brand/5"
                    : "text-heading hover:bg-elevated"
                }`}
              >
                <span>Layout local (navegador)</span>
                {!active && <Check className="w-3.5 h-3.5" />}
              </button>
            </li>

            {favoriteFirst.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-muted italic">
                Nenhum Layout salvo ainda.
              </li>
            ) : (
              favoriteFirst.map((p) => {
                const isActive = p._id.toString() === activeId;
                const isFav = p.favorites.includes(p.sub);
                return (
                  <li key={p._id.toString()} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleSelect(p._id.toString())}
                      className={`flex-1 flex items-center gap-2 px-3 py-2 text-xs min-w-0 ${
                        isActive
                          ? "text-brand font-medium bg-brand/5"
                          : "text-heading hover:bg-elevated"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[9px] text-muted font-mono shrink-0">
                        {p.kind}
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        favorite(p._id.toString());
                      }}
                      className="p-2 shrink-0"
                      title={isFav ? "Remover dos favoritos" : "Favoritar"}
                      aria-label={isFav ? "Remover dos favoritos" : "Favoritar"}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFav
                            ? "fill-warning-500 text-warning-500"
                            : "text-muted"
                        }`}
                      />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
