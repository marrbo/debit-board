// hooks/useActivePage.ts
"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { resolveNavItem, type NavItem } from "@/lib/navigation";

/**
 * Resolve o `NavItem` ativo para a rota corrente.
 *
 * Fonte única de verdade para:
 *  - `Header` (título, ícone, subtítulo)
 *  - `Sidebar`/`SettingsNav` (item destacado)
 *  - Breadcrumbs e command palette (futuros)
 *
 * @returns O `NavItem` correspondente, ou `null` se a rota não estiver
 *          registrada em `NAVIGATION`.
 */
export function useActivePage(): NavItem | null {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;

  return useMemo(
    () => resolveNavItem(pathname, { isAdmin }),
    [pathname, isAdmin],
  );
}
