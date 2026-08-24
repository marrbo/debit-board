// lib/settingsMenu.ts
import {
  ShieldCheck,
  Puzzle,
  UserCog,
  User, FolderGit2, GitBranchPlus, SquareAsterisk
} from 'lucide-react';

export const settingsMenuItems = [
  { href: '/settings/profile/user', label: 'Profile', icon: User },
  { href: '/settings/projects', label: 'Projetos', icon: FolderGit2 },
  { href: '/settings/repositories', label: 'Repositórios', icon: GitBranchPlus },
];

export const adminMenuItems = [
  ...settingsMenuItems,
  { href: '#', label: 'Integrations (Azure)', icon: Puzzle },
  { href: '#', label: 'Auth (OpenID)', icon: ShieldCheck },
  { href: '/settings/admin/patterns', label: 'Security Patterns', icon: SquareAsterisk },
  { href: '/settings/admin', label: 'Admin', icon: UserCog }  
];