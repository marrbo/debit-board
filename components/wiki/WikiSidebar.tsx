'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Folder, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export function WikiSidebar({ items }: { items: any[] }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`relative flex flex-col h-full transition-all duration-300 ease-in-out  bg-apple-secondary-light text-apple-label-dark border-r border-apple-border-dark ${
        collapsed ? 'w-4' : 'w-76'
      }`}
    >
      {/* 🔥 Botão estilo DeepSeek no topo direito */}
      <div className={`absolute top-5 z-20 bg-apple-tertiary-dark p-1 rounded-lg transition-all ${collapsed ? '-right-3.5' : 'right-3'}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center justify-center w-5 h-5 rounded-lg  text-apple-card-dark hover:text-white transition-all ${
            collapsed ? 'bg-transparent' : ''
          }`}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="w-6 h-6" /> : <PanelLeftClose className="w-6 h-6" />}
        </button>
      </div>

      {!collapsed ? (
        <div className="flex-1 overflow-y-auto py-6 pr-10 pl-4">
          <div className="space-y-1 text-sm">
            <WikiSidebarItems items={items} depth={0} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
        </div>
      )}
    </div>
  );
}

function WikiSidebarItems({ items, depth }: { items: any[], depth: number }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i}>
          {item.type === 'folder' ? (
            <div
              style={{ paddingLeft: `${depth * 12}px` }}
              className="flex items-center gap-2 py-1 text-apple-tertiary-dark hover:text-apple-label-dark cursor-pointer font-medium"
            >
              <Folder size={16} className="text-apple-tertiary-dark" />
              <span>{item.name}</span>
            </div>
          ) : (
            <Link
              href={item.url}
              className={`block py-1 hover:text-apple-label-dark transition-colors ${
                pathname === item.url
                  ? 'bg-apple-blue/10 text-apple-blue'
                  : 'text-apple-tertiary-light hover:bg-apple-card-light dark:hover:bg-apple-card-dark'
              }`}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} />
                {item.name === 'index' ? 'Home' : item.name}
              </div>
            </Link>
          )}
          {item.children && <WikiSidebarItems items={item.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}