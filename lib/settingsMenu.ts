// lib/settingsMenu.ts
import {
  ShieldCheck,
  Puzzle,
  UserCog,
  User, FolderGit2, GitBranchPlus, SquareAsterisk
} from 'lucide-react';

export const settingsMenuItems = [
  { href: '/settings/profile/user', label: 'Profile', icon: User },
  { href: '/settings/repository', label: 'Repositórios', icon: GitBranchPlus },
  { href: '/settings/projects', label: 'Projetos', icon: FolderGit2 },
  { href: '#', label: 'Auth (OpenID)', icon: ShieldCheck },
  { href: '#', label: 'Integrations (Azure)', icon: Puzzle },
  { href: '/settings/admin', label: 'Admin', icon: UserCog },
  { href: '/settings/admin/patterns', label: 'SAST Patterns', icon: SquareAsterisk },
];