// app/sast/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlayCircle, History, ShieldKeyhole } from 'lucide-react';

export default function SASTLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    { href: '/sast', label: 'Run Scanner', icon: PlayCircle },
    { href: '/sast/scans', label: 'Scan History', icon: History },
  ];

  return (
    <div className="flex p-8 flex-col md:flex-row w-full gap-6 mx-auto">
      {/* Sub-Sidebar do SAST */}
      <div className="w-full md:w-48 shrink-0 space-y-1">
        <h2 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-3 pt-2 pb-4 flex items-center gap-2">
          <ShieldKeyhole className="w-4 h-4" /> SAST Scanner
        </h2>
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 hover:text-gray-900 dark:text-white'}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo da página */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}