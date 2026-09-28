// lib/navigation.ts
import type { LucideIcon } from "lucide-react";
import {
  ChartAreaIcon,
  Binoculars,
  ShieldKeyhole,
  BookOpen,
  Settings,
  LayoutDashboard,
  FolderGit2,
  GitBranchPlus,
  DatabaseSearch,
  UserGroup,
  UserCog2,
  UserCog,
  SquareAsterisk,
  Database,
  ShieldCheck,
  Puzzle,
} from "lucide-react";
import { SiOpenapiinitiative } from "react-icons/si";
import type { Role } from "./permissions";

/**
 * Slot onde o item é renderizado.
 *
 * - `primary`   → topo da Sidebar (navegação principal).
 * - `secondary` → base da Sidebar (Wiki, Configurações).
 * - `settings`  → `SettingsNav` (sub-navegação de `/settings/*`).
 * - `hidden`    → não aparece em menu nenhum, mas o `Header` ainda
 *                 resolve os metadados (ex.: uma rota acessível só via
 *                 link externo).
 */
export type NavSlot = "primary" | "secondary" | "settings" | "hidden";

export interface NavItem {
  href: string;
  label: string;
  title?: string;
  subtitle?: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  slot: NavSlot;
  group?: string;
  teamAware?: boolean;
  /**
   * Papéis que podem ver este item. `undefined` ou `[]` → todos.
   * Substitui o antigo `adminOnly` (mantido por compatibilidade).
   */
  requiredRoles?: Role[];
  /** @deprecated — use `requiredRoles: ["admin"]`. Mantido para
   *  leitura do registry antigo. */
  adminOnly?: boolean;
  disabled?: boolean;
  order?: number;
}

/**
 * Fonte única de verdade para navegação, títulos, ícones e
 * subtítulos da aplicação.
 *
 * Consumido por:
 *  - `Sidebar`         (slots `primary` e `secondary`)
 *  - `SettingsNav`     (slot `settings`)
 *  - `Header`          (resolução de título/ícone/subtítulo)
 *  - `useActivePage`   (resolução de rota ativa)
 *  - Futuro: command palette, breadcrumbs, telemetria
 */
export const NAVIGATION: NavItem[] = [
  // ============================================================
  // Sidebar — navegação principal
  // ============================================================
  {
    href: "/",
    label: "Dashboard",
    subtitle: "Postura de segurança, tendências e comparativo entre times",
    icon: ChartAreaIcon,
    slot: "primary",
    teamAware: true,
    order: 0,
  },
  {
    href: "/observations",
    label: "Feed",
    title: "Observations Feed",
    subtitle: "Central de monitoramento de vulnerabilidades",
    icon: Binoculars,
    slot: "primary",
    teamAware: true,
    order: 1,
  },
  {
    href: "/sast",
    label: "Scan",
    title: "SAST Scanner",
    subtitle: "Executa o scanner e acompanhe o histórico de execuções",
    icon: ShieldKeyhole,
    slot: "primary",
    teamAware: true,
    order: 2,
  },

  // ============================================================
  // Sidebar — base
  // ============================================================
  {
    href: "/wiki",
    label: "Wiki",
    subtitle: "Documentação interna",
    icon: BookOpen,
    slot: "secondary",
    order: 0,
  },
  {
    href: "/settings",
    label: "",
    title: "Configurações",
    subtitle: "Tenant e integrações",
    icon: Settings,
    slot: "secondary",
    order: 1,
  },

  // ============================================================
  // Settings — Organização
  // ============================================================
  {
    href: "/settings/profile/user",
    label: "Perfil",
    title: "Perfil",
    subtitle: "Preferências pessoais e da conta",
    icon: UserCog2,
    slot: "settings",
    group: "Organização",
    order: 0,
  },
  {
    href: "/settings/dashboards",
    label: "Dashboards",
    title: "Dashboards",
    subtitle: "Layouts salvos do Dashboard e do Modo TV",
    icon: LayoutDashboard,
    slot: "settings",
    group: "Organização",
    order: 1,
  },
  {
    href: "/settings/projects",
    label: "Projetos",
    title: "Projetos",
    subtitle: "Projetos do Tenant e seus repositórios vinculados",
    icon: FolderGit2,
    slot: "settings",
    group: "Organização",
    order: 2,
  },
  {
    href: "/settings/repositories",
    label: "Repositórios",
    title: "Repositórios",
    subtitle: "Repositórios Git sincronizados com o Tenant",
    icon: GitBranchPlus,
    slot: "settings",
    group: "Organização",
    order: 3,
  },
  {
    href: "/settings/teams",
    label: "Times",
    title: "Times",
    subtitle: "Agrupamentos de projetos para atribuição",
    icon: UserGroup,
    slot: "settings",
    group: "Organização",
    order: 4,
  },
  {
    href: "/settings/saved-queries",
    label: "Queries",
    title: "Consultas Salvas",
    subtitle: "Consultas DBQL reutilizáveis",
    icon: DatabaseSearch,
    slot: "settings",
    group: "Organização",
    order: 5,
  },

  // ============================================================
  // Settings — Administração
  // ============================================================
  {
    href: "/settings/admin",
    label: "Admin",
    title: "Admin",
    subtitle: "Configuração global do Tenant",
    icon: UserCog,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    order: 0,
  },
  {
    href: "/settings/admin/patterns",
    label: "Padrões de Segurança",
    title: "Padrões de Segurança",
    subtitle: "Regras SAST aplicadas nas varreduras",
    icon: SquareAsterisk,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    order: 1,
  },
  {
    href: "/settings/admin/db-tools",
    label: "Backup & Restore",
    title: "Backup & Restore",
    subtitle: "Exportação e restauração do banco",
    icon: Database,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    order: 2,
  },
  {
    href: "/settings/admin/api-docs",
    label: "API Docs",
    title: "API Docs",
    subtitle: "Especificação OpenAPI",
    icon: SiOpenapiinitiative,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    order: 3,
  },
  {
    href: "#",
    label: "Auth (OpenID)",
    icon: ShieldCheck,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    disabled: true,
    order: 4,
  },
  {
    href: "#",
    label: "Integrations (Azure)",
    icon: Puzzle,
    slot: "settings",
    group: "Administração",
    requiredRoles: ["admin"],
    disabled: true,
    order: 5,
  },
];

/** Ordem canônica dos grupos do slot `settings`. */
export const SETTINGS_GROUP_ORDER = ["Organização", "Administração"] as const;

/**
 * Resolve o `NavItem` mais específico para o `pathname` informado.
 *
 * Critérios:
 *  1. Match exato de `href`.
 *  2. Prefixo (`pathname.startsWith(href + "/")`).
 *  3. Entre múltiplos candidatos, o de `href` mais longo vence —
 *     garante que `/settings/admin/patterns` ganhe de `/settings/admin`
 *     e de `/settings`.
 *
 * Filtra por `adminOnly` quando `isAdmin === false`.
 */

export function resolveNavItem(
  pathname: string,
  opts: { isAdmin?: boolean; includeHidden?: boolean } = {},
): NavItem | null {
  const { isAdmin = false, includeHidden = true } = opts;

  const candidates = NAVIGATION.filter((item) => {
    if (item.disabled) return false;
    if (!includeHidden && item.slot === "hidden") return false;
    // Backwards compat: `adminOnly` ainda vale.
    if (item.adminOnly && !isAdmin) return false;
    // RBAC novo: `requiredRoles` — `admin` implica todos.
    if (item.requiredRoles?.length && !isAdmin) {
      // Enquanto `rolesFromSession` precisar de sessão inteira,
      // aqui só temos `isAdmin`. O caller pode passar `roles`
      // explícito quando precisar de granularidade.
      return false;
    }
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.href.length - a.href.length)[0];
}
