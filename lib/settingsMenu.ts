import {
  ShieldCheck,
  Puzzle,
  UserCog,
  User,
  FolderGit2,
  GitBranchPlus,
  SquareAsterisk,
  DatabaseSearch
} from 'lucide-react';

// Itens comuns
export const settingsMenuItems = [
  { href: '/settings/profile/user', label: 'Profile', icon: User },
  { href: '/settings/projects', label: 'Projetos', icon: FolderGit2 },
  { href: '/settings/repositories', label: 'Repositórios', icon: GitBranchPlus },
  { href: '/settings/saved-queries', label: 'Queries', icon: DatabaseSearch },
];

// Itens de admin
export const adminMenuItems = [
  { href: '/settings/admin/patterns', label: 'Security Patterns', icon: SquareAsterisk },
  { href: '#', label: 'Integrations (Azure)', icon: Puzzle },
  { href: '#', label: 'Auth (OpenID)', icon: ShieldCheck },
  { href: '/settings/admin', label: 'Admin', icon: UserCog },
];

// Grupos (exportação obrigatória)
export const settingsMenuGroups = [
  {
    label: 'Organização',
    items: settingsMenuItems,
    adminOnly: false,
  },
  {
    label: 'Administração',
    items: adminMenuItems,
    adminOnly: true,
  },
];