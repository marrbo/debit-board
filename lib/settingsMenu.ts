// lib/settingsMenu.ts
import {
  ShieldCheck,
  Puzzle,
  UserCog,
  FolderGit2,
  GitBranchPlus,
  SquareAsterisk,
  DatabaseSearch,
  UserCog2,
  UserGroup,
  Database,
} from "lucide-react";
import { SiOpenapiinitiative } from "react-icons/si";

type MenuItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const byLabel = (a: MenuItem, b: MenuItem) =>
  a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });

export const settingsMenuItems: MenuItem[] = [
  { href: "/settings/profile/user", label: "Perfil", icon: UserCog2 },
  { href: "/settings/projects", label: "Projetos", icon: FolderGit2 },
  { href: "/settings/saved-queries", label: "Queries", icon: DatabaseSearch },
  {
    href: "/settings/repositories",
    label: "Repositórios",
    icon: GitBranchPlus,
  },
  { href: "/settings/teams", label: "Times", icon: UserGroup },
].sort(byLabel);

export const adminMenuItems: MenuItem[] = [
  { href: "/settings/admin", label: "Admin", icon: UserCog },
  {
    href: "/settings/admin/api-docs",
    label: "API Docs",
    icon: SiOpenapiinitiative,
  },
  { href: "#", label: "Auth (OpenID)", icon: ShieldCheck },
  {
    href: "/settings/admin/db-tools",
    label: "Backup & Restore",
    icon: Database,
  },
  { href: "#", label: "Integrations (Azure)", icon: Puzzle },
  {
    href: "/settings/admin/patterns",
    label: "Padrões de Segurança",
    icon: SquareAsterisk,
  },
].sort(byLabel);

export const settingsMenuGroups = [
  {
    label: "Organização",
    items: settingsMenuItems,
    adminOnly: false,
  },
  {
    label: "Administração",
    items: adminMenuItems,
    adminOnly: true,
  },
];
