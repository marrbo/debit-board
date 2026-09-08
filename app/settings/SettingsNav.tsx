'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { settingsMenuGroups } from '@/lib/settingsMenu';

export default function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`relative flex flex-col h-full transition-all duration-300 ease-in-out bg-sunken dark:bg-black/20 text-heading border-r border-strong ${
        collapsed ? 'w-4' : 'w-76'
      }`}
    >
      {/* 🔥 Botão estilo DeepSeek no topo direito */}
      <div className={`absolute top-5 z-20 bg-sunken p-1 rounded-sm transition-all ${collapsed ? '-right-3.5' : 'right-3'}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center justify-center w-5 h-5 rounded-lg  text-apple-card-dark hover:text-brand transition-all ${
            collapsed ? 'bg-sunken' : ''
          }`}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="w-6 h-6" /> : <PanelLeftClose className="w-6 h-6" />}
        </button>
      </div>

      {/* Conteúdo do menu */}
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto py-6 pr-10 pl-4">
          <div className="space-y-4">
            {settingsMenuGroups.map((group) => {
              if (group.adminOnly && !isAdmin) return null;
              return (
                <div key={group.label} className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider px-3 py-2 text-muted">
                    {group.label}
                  </div>
                  {group.items.map((item, index) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={`${group.label}-${index}`}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-brand/10 text-brand'
                            : 'text-muted hover:bg-surface dark:hover:bg-surface'
                        }`}
                      >
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-brand' : 'text-muted '}`} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
        </div>
      )}
    </div>
  );
}