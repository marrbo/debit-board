"use client";

import React from "react";
import { SearchCode, SearchX } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import DBQLAdvancedSearch from "@/components/dbql/DBQLAdvancedSearch";
import { SimpleColumnSearch } from "@/components/dbql/SimpleColumnSearch";
import { useSearchVisible } from "@/hooks/useLocalSettings";

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
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  search?: PageSearchConfig;
}

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

  const hasSearch = !!search;

  // URL manda: se ?q= existe, a busca é forçada visível no primeiro render.
  // Depois disso o usuário pode ocultar via toggle — a URL continua válida.
  // const [hasUserToggled, setHasUserToggled] = React.useState(false);
  const urlHasQuery = !!searchParams.get("q");

  const isSearchVisible = visible;
  // hasUserToggled
  //   ? visible
  //   : urlHasQuery || visible;

  const handleToggle = () => {
    // setHasUserToggled(true);
    toggle();
  };

  return (
    <div className="border-b border-default dark:border-strong pb-4 mb-4 transition-colors">
      {/* Linha principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && (
            <div className="flex items-center text-brand -mt-2 shrink-0 animate-[bounce_1s_linear_0.5]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl -mt-2 font-bold text-heading dark:text-heading truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="min-w-full text-xs font-mono text-muted dark:text-muted mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {(actions || hasSearch) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 p-1 rounded-lg">
            {hasSearch && (
              <button
                type="button"
                onClick={handleToggle}
                className={`flex items-center group btn-secondary`}
                title={isSearchVisible ? "Ocultar busca" : "Mostrar busca"}
                aria-label={isSearchVisible ? "Ocultar busca" : "Mostrar busca"}
                aria-pressed={isSearchVisible}
              >
                <span className="hidden group-hover:inline text-xs whitespace-nowrap mr-2">
                  {isSearchVisible ? "Ocultar " : "Mostrar "}Busca
                  {urlHasQuery && !isSearchVisible ? (
                    <span className="font-mono text-[8px] align-super"></span>
                  ) : null}
                </span>
                {isSearchVisible ? (
                  <>
                    <SearchX className="w-4 h-4 text-error" />
                  </>
                ) : (
                  <>
                    <SearchCode className="w-4 h-4" />

                    <span
                      className={`absolute z-9 ml-5 group-hover:hidden -mt-6 w-3 h-3 bg-green-300 rounded-full ${
                        urlHasQuery && !isSearchVisible
                          ? "block animate-ping"
                          : "hidden"
                      }`}
                    ></span>
                    <span
                      className={`absolute ml-[22px] group-hover:hidden -mt-6 w-2 h-2 z-8 bg-green-500 rounded-full ${
                        urlHasQuery && !isSearchVisible ? "block" : "hidden"
                      }`}
                    ></span>
                  </>
                )}
              </button>
            )}
            {actions}
          </div>
        )}
      </div>

      {/* Barra de busca + filtros
          - O DBQLAdvancedSearch fica SEMPRE montado (mesmo escondido).
          - Ocultamos com `hidden` (display: none) — os efeitos continuam rodando,
            então a leitura de `?q=` da URL e o callback `onSearch` continuam vivos.
          - Filtros independentes continuam visíveis. */}
      {(search || filters) && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mt-4">
          {search && (
            <div className={isSearchVisible ? "flex-1" : "hidden"}>
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
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          )}
        </div>
      )}
    </div>
  );
}
