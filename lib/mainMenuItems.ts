// lib/mainMenuItems.ts
import { 
  BarChart3, 
  Bug, 
  Shield, 
  Search, 
  BookOpen, 
  Settings,
  LucideIcon
} from 'lucide-react';

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Itens do topo (Navegação principal)
export const topNavItems: MenuItem[] = [
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/issues', label: 'Issues', icon: Bug },
  { href: '/sast', label: 'SAST', icon: Shield },
  { href: '/azure-search-code', label: 'Search', icon: Search },
];

// Itens da base (Wiki e Settings, logo acima do botão Account)
export const bottomNavItems: MenuItem[] = [
  { href: '/wiki', label: 'Wiki', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];