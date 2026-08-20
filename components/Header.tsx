// components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, Search, Shield, Settings, UserCog, AlertCircle } from 'lucide-react';
import UserMenu from './UserMenu';

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const navItems = [
    { href: '/stats', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/azure-search-code', label: 'Azure Search Code', icon: Search },
    { href: '/sast', label: 'SAST Scanner', icon: Shield },
    { href: '/observations', label: 'Observations', icon: AlertCircle },
    ...(isAdmin ? [{ href: '/settings/admin', label: 'Admin', icon: UserCog }] : []),
  ];

  return (
    <header className="bg-apple-card-light dark:bg-apple-card-dark border-b border-apple-border-light dark:border-apple-border-dark sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-apple-blue rounded-lg text-white">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <path d="M12 26 C4 26 2 20 2 20 C2 20 4 14 12 14 C18 14 20 20 20 20 C20 20 18 26 12 26 Z" fill="#ffffff" opacity="0.8"/>
              <path d="M28 26 C36 26 38 20 38 20 C38 20 36 14 28 14 C22 14 20 20 20 20 C20 20 22 26 28 26 Z" fill="#ffffff" opacity="0.8"/>
              <circle cx="12" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
              <circle cx="28" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-apple-label-light dark:text-apple-label-dark">DebitBoard</h1>
            <p className="text-xs text-apple-tertiary-light">SAST & Observabilidade</p>
          </div>
        </div>
        
        <nav className="flex flex-wrap items-center gap-1 md:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-tertiary-light hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] hover:text-apple-label-light dark:hover:text-apple-label-dark'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}