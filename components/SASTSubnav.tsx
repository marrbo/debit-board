// components/SASTSubnav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldKeyhole } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/sast", label: "Histórico", icon: ShieldKeyhole },
  { href: "/sast/timeline", label: "Timeline", icon: Activity },
];

/**
 * Sub-navegação entre as views do SAST (Histórico e Timeline).
 *
 * Não é `role="tablist"` — cada item navega para uma URL distinta,
 * então o padrão correto é `<nav>` + `<Link aria-current="page">`.
 * `role="tab"` é reservado para painéis na mesma URL sem mudança de
 * rota (screen readers anunciam "tab 1 de 2" e usuários esperam
 * alternância local, não navegação).
 *
 * Acessibilidade:
 *   - Altura das tabs ≥ 44px (WCAG 2.5.5).
 *   - `focus-visible` herdado do tema global (contorno `--border-focus`).
 *   - `aria-current="page"` no item ativo.
 *   - Navegação por teclado nativa via `<a>`.
 */
export default function SASTSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sub-navegação SAST"
      className="flex items-center gap-1 border-b border-default -mt-2"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] ${
              active ? "text-brand" : "text-muted hover:text-heading"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-px h-0.5 bg-brand rounded-full"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
