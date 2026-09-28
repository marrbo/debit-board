// lib/permissions.ts
import type { Session } from "next-auth";

/**
 * Papéis reconhecidos pelo sistema.
 *
 * - `admin`   — acesso a `/settings/admin/*`, gestão de tenant,
 *               impersonation, backup/restore.
 * - `analyst` — usuário autenticado padrão. Lê e opera observações,
 *               projetos, times, e salva dashboards.
 *
 * Papéis são derivados de:
 *  - Grupo Keycloak `Administrators` (root) → `admin`.
 *  - Realm role `admin`                     → `admin`.
 *  - E-mail em `NEXT_PUBLIC_ADMIN_EMAIL`    → `admin` (fallback dev).
 *  - Qualquer outro usuário autenticado      → `analyst`.
 *
 * Estender no futuro: adicionar novo papel aqui, mais uma regra em
 * `extractRoles`, e adicionar `requiredRoles` nos `NavItem`s que
 * restringe.
 */
export type Role = "admin" | "analyst";

export interface RoleSource {
  groups?: string[];
  realmRoles?: string[];
  isAdmin?: boolean;
}

/**
 * Deriva a lista de papéis a partir das claims do token.
 * Determinístico: mesma entrada → mesma saída (sem I/O).
 */
export function extractRoles(source: RoleSource): Role[] {
  const roles = new Set<Role>();
  if (source.isAdmin) roles.add("admin");
  // Todo autenticado é `analyst` — base do sistema.
  roles.add("analyst");
  return Array.from(roles);
}

/**
 * Deriva papéis diretamente de uma sessão NextAuth.
 * Fonte de verdade para client e server.
 */
export function rolesFromSession(session: Session | null): Role[] {
  if (!session?.user) return [];
  return extractRoles({
    groups: session.user.groups,
    realmRoles: session.user.realmRoles,
    isAdmin: session.user.isAdmin,
  });
}

export function hasRole(userRoles: Role[], role: Role): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: Role[], required: Role[]): boolean {
  if (required.length === 0) return true;
  return required.some((r) => userRoles.includes(r));
}

export function hasAllRoles(userRoles: Role[], required: Role[]): boolean {
  return required.every((r) => userRoles.includes(r));
}
