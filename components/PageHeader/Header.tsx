// components/PageHeader/Header.tsx
"use client";

import React, { useMemo } from "react";
import { SearchCode, SearchX } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import DBQLAdvancedSearch from "@/components/dbql/DBQLAdvancedSearch";
import { SimpleColumnSearch } from "@/components/dbql/SimpleColumnSearch";
import { useSearchVisible, useTeam } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";
import { useActivePage } from "@/hooks/useActivePage";
import AIChatButton from "../ai/AIChatbutton";
import HeaderActions from "./HeaderActions";

export type PageSearchConfig =
  | {
      type: "advanced";
      onSearch: (value: any) => void;
      userSub: string;
      context?: string;
      placeholder?: string;
    }
  | {
      type: "simple";
      onSearch: (column: string | null, value: string) => void;
      userSub: string;
      columns: {
        key: string | number | symbol;
        label: string;
        sortable?: boolean;
      }[];
      placeholder?: string;
    };

interface PageHeaderProps {
  /**
   * Título. Quando omitido, resolve do `NAVIGATION` via
   * `useActivePage()`. Passe apenas em casos dinâmicos.
   */
  title?: string;
  /** Ícone. Mesma regra do `title`. */
  icon?: React.ReactNode;
  /** Subtítulo. Mesma regra do `title`. */
  subtitle?: string;
  /** Ações à direita (botões `HeaderActions` icon-only). */
  actions?: React.ReactNode;
  /** Filtros independentes, ao lado da busca. */
  filters?: React.ReactNode;
  /** Configuração de busca. */
  search?: PageSearchConfig;
}

/**
 * Cabeçalho compacto.
 *
 * **Auto-preenchimento**: título, ícone e subtítulo vêm do
 * `NAVIGATION`. `navItem.teamAware` prefixa o subtítulo com o nome do
 * time ativo — comportamento uniforme em toda a aplicação, sem
 * duplicação por página.
 *
 * **Layout** (2 linhas):
 *   1. [icon] Título · Subtítulo ...... [AIChat] [🔍] [actions]
 *   2. [busca ......................] [filters]
 */
export default function PageHeader({
  title,
  icon,
  subtitle,
  actions,
  filters,
  search,
}: PageHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { visible, toggle } = useSearchVisible(pathname);
  const navItem = useActivePage();

  const [teamId] = useTeam();
  const { teams } = useTeams();

  const hasSearch = !!search;
  const urlHasQuery = !!searchParams.get("q");

  // ---------- Título / ícone / subtítulo efetivos ----------
  const effectiveTitle = title ?? navItem?.title ?? navItem?.label ?? "";

  const effectiveIcon = useMemo(() => {
    if (icon) return icon;
    if (!navItem?.icon) return null;
    const Icon = navItem.icon;
    return <Icon className="w-6 h-6" />;
  }, [icon, navItem?.icon]);

  const teamLabel = useMemo(() => {
    if (!navItem?.teamAware) return null;
    if (!teamId) return null;
    const team = teams.find((t) => t._id === teamId);
    if (!team) return null;
    return team.isGlobal ? "Todos os times" : team.name;
  }, [navItem?.teamAware, teamId, teams]);

  const effectiveSubtitle = useMemo(() => {
    const base = subtitle ?? navItem?.subtitle ?? "";
    if (!teamLabel) return base;
    return base ? `${teamLabel} · ${base}` : teamLabel;
  }, [subtitle, navItem?.subtitle, teamLabel]);

  const isSearchVisible = visible;

  return (
    <div className="pb-3 -mt-5 mb-3 transition-colors">
      {/* ---------- Linha 1: título + ações ---------- */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {effectiveIcon && (
            <div className="shrink-0 text-brand">{effectiveIcon}</div>
          )}
          <h1 className="text-lg font-bold text-heading truncate shrink-0">
            {effectiveTitle}
          </h1>
          {effectiveSubtitle && (
            <>
              <span
                className="hidden md:inline text-brand/60 shrink-0 text-[7px]"
                aria-hidden="true"
              >
                *
              </span>
              <span className="hidden md:inline text-xs font-mono text-muted truncate">
                {effectiveSubtitle}
              </span>
            </>
          )}
        </div>

        <div id="jegue" className="flex items-center gap-1 shrink-0">
          <AIChatButton
            context="observations"
            title={`Assistente IA — ${effectiveTitle}`}
          />

          {hasSearch && (
            <HeaderActions
              ref={null}
              tooltip={isSearchVisible ? "Ocultar busca" : "Mostrar busca"}
              color="error"
              onClick={toggle}
              aria-haspopup="dialog"
              aria-expanded={isSearchVisible}
              isActive={isSearchVisible}
            >
              {isSearchVisible ? (
                <SearchX className="w-4 h-4 text-error" />
              ) : (
                <SearchCode className="w-4 h-4" />
              )}
              {urlHasQuery && !isSearchVisible && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-success" />
              )}
            </HeaderActions>
          )}

          {actions}
        </div>
      </div>

      {/* ---------- Linha 2: busca + filtros ---------- */}
      {(search || filters) && (
        <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2.5">
          {search && (
            <div className={isSearchVisible ? "flex-1 min-w-0" : "hidden"}>
              {search.type === "advanced" ? (
                <DBQLAdvancedSearch
                  onSearch={search.onSearch}
                  userSub={search.userSub}
                  placeholder={search.placeholder}
                  context={search.context}
                />
              ) : (
                <SimpleColumnSearch
                  columns={search.columns || []}
                  onSearch={search.onSearch}
                  placeholder={search.placeholder}
                />
              )}
            </div>
          )}
          {filters && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {filters}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
