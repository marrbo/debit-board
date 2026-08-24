// components/PageHeader.tsx
'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  searchBar?: React.ReactNode;
}

export default function PageHeader({ 
  title, 
  icon,
  subtitle, 
  filters,
  actions, 
  searchBar 
}: PageHeaderProps) {
  return (
    <div className="border-b border-apple-border-light dark:border-apple-border-dark pb-4 mb-4 transition-colors">
      {/* Linha Principal: Bloco Esquerdo (Ícone + Título/Subtítulo) e Ações (Direita) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Esquerda: Ícone centralizado verticalmente com o bloco de texto */}
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && (
            <div className="flex items-center text-apple-blue shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl -mt-2 font-bold text-apple-label-light dark:text-apple-label-dark truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="min-w-full text-xs font-mono text-apple-tertiary-light dark:text-apple-tertiary-light mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Direita: Ações */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Seção Opcional: Barra de Pesquisa e Filtros */}
      {(searchBar || filters) && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mt-4">
          {searchBar && <div className="flex-1">{searchBar}</div>}
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        </div>
      )}
    </div>
  );
}