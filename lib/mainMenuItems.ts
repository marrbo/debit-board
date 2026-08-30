// lib/mainMenuItems.ts
import { 
  BarChart3, 
  ShieldKeyhole, 
  SearchCode, 
  BookOpen, 
  Settings,
  Binoculars
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Itens do topo (Navegação principal)
export const topNavItems: MenuItem[] = [
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/observations', label: 'Observations', icon: Binoculars },
  { href: '/sast', label: 'SAST', icon: ShieldKeyhole },
  { href: '/azure-search-code', label: 'Search', icon: SearchCode },
];

// Itens da base (Wiki e Settings, logo acima do botão Account)
export const bottomNavItems: MenuItem[] = [
  { href: '/wiki', label: 'Wiki', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];