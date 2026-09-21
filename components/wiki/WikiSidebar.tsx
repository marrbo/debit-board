"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocalSetting } from "@/hooks/useLocalSettings";

export function WikiSidebar({ items }: { items: any[] }) {
  const [collapsed, setCollapsed] = useLocalSetting("wikiSidebar");

  return (
    <div
      className={`relative flex flex-col h-full transition-all duration-300 ease-in-out bg-sunken text-heading border-r border-strong ${
        collapsed ? "w-4" : "w-76"
      }`}
    >
      {/* 🔥 Botão estilo DeepSeek no topo direito */}
      <div
        className={`absolute top-5 z-20 bg-sunken p-1 rounded-sm transition-all ${
          collapsed ? "-right-3.5" : "right-3"
        }`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex p-0 items-center hover:!bg-transparent justify-center w-4 h-4 rounded-sm text-muted hover:text-brand transition-all ${
            collapsed ? "bg-sunken" : ""
          }`}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed ? (
        <div className="flex-1 overflow-y-auto py-4 p-8 px-8">
          <div className="space-y-1 text-sm">
            <WikiSidebarItems items={items} depth={0} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6"></div>
      )}
    </div>
  );
}

function WikiSidebarItems({ items, depth }: { items: any[]; depth: number }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i}>
          {item.type === "folder" ? (
            <div
              style={{ paddingLeft: `${depth * 12}px` }}
              className="flex items-center gap-2 py-1 text-muted hover:text-heading cursor-pointer font-medium"
            >
              <Folder size={16} className="text-muted" />
              <span>{item.name}</span>
            </div>
          ) : (
            <Link
              href={item.url}
              className={`block py-1 hover:text-heading transition-colors ${
                pathname === item.url
                  ? "bg-brand/10 text-brand"
                  : "text-muted hover:bg-surface dark:hover:bg-surface"
              }`}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} />
                {item.name === "index" ? "Home" : item.name}
              </div>
            </Link>
          )}
          {item.children && (
            <WikiSidebarItems items={item.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
