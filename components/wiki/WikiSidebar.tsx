"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { useLocalSetting } from "@/hooks/useLocalSettings";

interface WikiSidebarProps {
  items: any[];
  isAdmin?: boolean;
}

export function WikiSidebar({ items, isAdmin = false }: WikiSidebarProps) {
  const [collapsed, setCollapsed] = useLocalSetting("wikiSidebar");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newPageBase, setNewPageBase] = useState<string | null>(null);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  return (
    <div
      className={`relative flex flex-col h-full transition-all duration-300 ease-in-out bg-sunken text-heading border-r border-strong ${
        collapsed ? "w-4" : "w-76"
      }`}
    >
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
        <div className="flex-1 overflow-y-auto py-4 px-8">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setNewPageBase("")}
              className="group flex items-center gap-2 w-full py-1 mb-3 text-sm font-medium text-muted hover:text-brand transition-colors"
            >
              <FolderPlus size={16} />
              <span>Nova página</span>
            </button>
          )}

          <div className="space-y-0.5 text-sm">
            <WikiSidebarItems
              items={items}
              depth={0}
              parentPath=""
              isAdmin={isAdmin}
              expanded={expanded}
              onToggleFolder={toggleFolder}
              onAddChild={setNewPageBase}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6" />
      )}

      {newPageBase !== null && (
        <NewPageModal
          defaultPath={newPageBase}
          onClose={() => setNewPageBase(null)}
        />
      )}
    </div>
  );
}

interface SidebarItemsProps {
  items: any[];
  depth: number;
  parentPath: string;
  isAdmin: boolean;
  expanded: Set<string>;
  onToggleFolder: (path: string) => void;
  onAddChild: (basePath: string) => void;
}

function WikiSidebarItems({
  items,
  depth,
  parentPath,
  isAdmin,
  expanded,
  onToggleFolder,
  onAddChild,
}: SidebarItemsProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-0.5">
      {items.map((item, i) => {
        if (item.type === "folder") {
          const folderPath = parentPath
            ? `${parentPath}/${item.name}`
            : item.name;
          const isExpanded = expanded.has(folderPath);
          const hasChildren = !!item.children?.length;

          return (
            <div key={i}>
              <div
                className="group flex items-center gap-1 py-1 text-muted hover:text-heading font-medium"
                style={{ paddingLeft: `${depth * 12}px` }}
              >
                <button
                  type="button"
                  onClick={() => hasChildren && onToggleFolder(folderPath)}
                  disabled={!hasChildren}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <ChevronRight
                    size={14}
                    className={`shrink-0 text-muted transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    } ${hasChildren ? "" : "opacity-0"}`}
                  />
                  {isExpanded ? (
                    <FolderOpen size={16} className="shrink-0 text-muted" />
                  ) : (
                    <Folder size={16} className="shrink-0 text-muted" />
                  )}
                  <span className="truncate">{item.name}</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild(folderPath);
                    }}
                    title={`Nova página em ${folderPath}/`}
                    aria-label={`Nova página em ${folderPath}/`}
                    className="ml-auto mr-1 p-1 rounded-sm text-muted hover:text-brand hover:bg-surface transition-all opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus:opacity-100"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {isExpanded && item.children && (
                <WikiSidebarItems
                  items={item.children}
                  depth={depth + 1}
                  parentPath={folderPath}
                  isAdmin={isAdmin}
                  expanded={expanded}
                  onToggleFolder={onToggleFolder}
                  onAddChild={onAddChild}
                />
              )}
            </div>
          );
        }

        return (
          <Link
            key={i}
            href={item.url}
            className={`block py-1 transition-colors ${
              pathname === item.url
                ? "bg-brand/10 text-brand"
                : "text-muted hover:text-heading hover:bg-surface dark:hover:bg-surface"
            }`}
            style={{ paddingLeft: `${depth * 12 + 26}px` }}
          >
            <div className="flex items-center gap-2">
              <FileText size={14} className="shrink-0" />
              <span className="truncate">
                {item.name === "index" ? "Home" : item.name}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NewPageModal({
  defaultPath,
  onClose,
}: {
  defaultPath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultPath ? `${defaultPath}/` : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const slug = value.trim().replace(/^\/+|\/+$/g, "");
    if (!slug) return setError("Informe um caminho.");
    if (/\.\./.test(slug)) return setError("Caminho inválido.");

    setSaving(true);
    try {
      const res = await fetch("/api/wiki/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erro ao criar página.");

      // Fecha o modal ANTES de navegar. Sem isso, o `WikiSidebar` continua
      // montado durante a transição e o modal fica preso na tela.
      onClose();
      router.push(`/wiki/${data.slug}?edit=true`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1C1C1E] border border-default dark:border-strong rounded-lg p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-heading dark:text-heading">
            {defaultPath ? `Nova página em ${defaultPath}/` : "Nova página"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-error"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">
              Caminho (sem <code>.md</code>)
            </label>
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                defaultPath
                  ? `${defaultPath}/sub/secao`
                  : "user-guide/dbql/4.Limits"
              }
              className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-default dark:border-strong rounded-lg text-xs outline-none focus:border-brand text-heading dark:text-heading font-mono"
            />
            <span className="text-[10px] text-muted">
              Subpastas são criadas automaticamente.
            </span>
          </div>

          {error && (
            <div className="text-xs text-error bg-apple-red/5 border border-apple-red/15 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:bg-apple-border-light/30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!value.trim() || saving}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Criando..." : "Criar e editar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
