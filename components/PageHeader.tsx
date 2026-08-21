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
  actions, 
  searchBar 
}: PageHeaderProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-apple-border-light dark:border-apple-border-dark pb-4 mb-4 transition-colors">
        <div>
          {icon && <div className="mb-2 text-apple-blue">{icon}</div>}
          <h1 className="text-xl font-bold text-apple-label-light dark:text-apple-label-dark">{title}</h1>
          {subtitle && <p className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-light mt-1">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      </div>

      {searchBar && (
        <div className="mb-6">
          {searchBar}
        </div>
      )}
    </>
  );
}