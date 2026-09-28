// hooks/usePermissions.ts
"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  rolesFromSession,
  hasAnyRole,
  hasRole,
  type Role,
} from "@/lib/permissions";

export interface UsePermissionsResult {
  roles: Role[];
  isAdmin: boolean;
  isAnalyst: boolean;
  /** True quando o usuário tem **pelo menos um** dos papéis. */
  hasRole: (role: Role) => boolean;
  /** True quando tem **qualquer um** dos papéis (OR). */
  hasAnyRole: (roles: Role[]) => boolean;
  /** True quando não há exigência de papel (`required` vazio). */
  canAccess: (required?: Role[]) => boolean;
}

/**
 * Papéis e capacidades do usuário corrente, derivados da sessão.
 *
 * Uso:
 *   const { isAdmin, canAccess } = usePermissions();
 *   if (!canAccess(["admin"])) return null;
 *
 * Substitui o antigo `session.user.isAdmin` espalhado — centraliza a
 * derivação e permite estender papéis sem tocar em N componentes.
 */
export function usePermissions(): UsePermissionsResult {
  const { data: session } = useSession();

  const roles = useMemo(() => rolesFromSession(session), [session]);

  return useMemo(
    () => ({
      roles,
      isAdmin: hasRole(roles, "admin"),
      isAnalyst: hasRole(roles, "analyst"),
      hasRole: (role: Role) => hasRole(roles, role),
      hasAnyRole: (required: Role[]) => hasAnyRole(roles, required),
      canAccess: (required?: Role[]) =>
        !required || required.length === 0 ? true : hasAnyRole(roles, required),
    }),
    [roles],
  );
}
