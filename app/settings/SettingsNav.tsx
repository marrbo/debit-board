'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { settingsMenuGroups } from '@/lib/settingsMenu';

export default function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`relative flex flex-col h-full transition-all duration-300 ease-in-out  bg-apple-secondary-light text-apple-label-dark border-r border-apple-border-dark ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 🔥 Botão estilo DeepSeek no topo direito */}
      <div className="absolute top-3 right-3 z-20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center justify-center w-8 h-8 rounded-lg  text-apple-tertiary-dark hover:text-apple-blue transition-all ${
            collapsed ? 'bg-transparent' : ''
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
                  <div className="text-xs font-bold uppercase tracking-wider px-3 py-2 text-apple-tertiary-light">
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
                            ? 'bg-apple-blue/10 text-apple-blue'
                            : 'text-apple-tertiary-light hover:bg-apple-card-light dark:hover:bg-apple-card-dark'
                        }`}
                      >
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-apple-blue' : 'text-apple-tertiary-light '}`} />
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
          <Settings className="w-6 h-6 text-apple-tertiary-light dark:text-apple-tertiary-dark" />
          <span
            className="text-xs font-medium text-apple-tertiary-light dark:text-apple-tertiary-dark"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Settings
          </span>
        </div>
      )}
    </div>
  );
}