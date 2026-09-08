'use client';

import React, { useState } from 'react';
import { SearchCode, SearchX } from 'lucide-react';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';
import { SimpleColumnSearch } from '@/components/dbql/SimpleColumnSearch';

export type PageSearchConfig =
  | {
      type: 'advanced';
      onSearch: (value: any) => void;
      userId: string;
      context?: string;
      placeholder?: string;
    }
  | {
      type: 'simple';
      onSearch: (column: string | null, value: string) => void;
      userId: string;
      columns: { key: string | number | symbol; label: string; sortable?: boolean }[];
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
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const hasSearch = !!search;

  return (
    <div className="border-b border-default dark:border-strong pb-4 mb-4 transition-colors">
      {/* Linha principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && <div className="flex items-center text-brand shrink-0">{icon}</div>}
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
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasSearch && (
              <button
                onClick={() => setIsSearchVisible(!isSearchVisible)}
                className={`flex items-center group gap-2 px-4 py-2 rounded-2xl border border-default bg-white text-brand text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed" ${
                  isSearchVisible
                    ? 'text-muted hover:text-error'
                    : 'text-muted hover:text-brand'
                }`}
                title={isSearchVisible ? 'Ocultar busca' : 'Mostrar busca'}
                aria-label={isSearchVisible ? 'Ocultar busca' : 'Mostrar busca'}
              >
                <span className="hidden group-hover:block">{search.type === 'advanced' ? 'DBQL Advanced Search' : 'Busca'}</span>
                {isSearchVisible ? <SearchX className="w-4 h-4" /> : <SearchCode className="w-4 h-4" />}
              </button>
            )}
            {actions}
          </div>
        )}
      </div>

      {/* Barra de busca + filtros */}
      {(search && isSearchVisible) || filters ? (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mt-4">
          {search && isSearchVisible && (
            <div className="flex-1">
              {search.type === 'advanced' ? (
                <DBQLAdvancedSearch
                  onSearch={search.onSearch}
                  userId={search.userId}
                  placeholder={search.placeholder}
                  context={search.context}
                />
              ) : (
                <SimpleColumnSearch
                  columns={search.columns || []}
                  onSearch={search.onSearch} // agora sabe que espera (column, value)
                  placeholder={search.placeholder}
                />
              )}
            </div>
          )}
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        </div>
      ) : null}
    </div>
  );
}