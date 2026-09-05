// components/KPICards.tsx
'use client';

import type { SearchItem } from '@/lib/types';
import { FileCode, FolderTree, GitBranch, Target } from 'lucide-react';

interface KPICardsProps {
  items: SearchItem[];
}

export default function KPICards({ items }: KPICardsProps) {
  const totalFiles = items.length;
  const uniqueProjects = new Set(items.map((i) => i.project)).size;
  const uniqueRepos = new Set(items.map((i) => i.repository)).size;
  const totalHits = items.reduce((sum, item) => sum + (item.hitCount || 0), 0);

  const cards = [
    {
      label: 'Total de Arquivos',
      value: totalFiles,
      icon: FileCode,
      color: 'text-apple-blue',
      bg: 'bg-apple-blue/10',
    },
    {
      label: 'Projetos',
      value: uniqueProjects,
      icon: FolderTree,
      color: 'text-apple-green',
      bg: 'bg-apple-green/10',
    },
    {
      label: 'Repositórios',
      value: uniqueRepos,
      icon: GitBranch,
      color: 'text-[#AF52DE]',
      bg: 'bg-[#AF52DE]/10',
    },
    {
      label: 'Total Hits',
      value: totalHits,
      icon: Target,
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-colors"
        >
          <div>
            <p className="text-[10px] uppercase font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark tracking-wider">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark mt-1">{card.value}</p>
          </div>
          <div className={`p-3 rounded-xl ${card.bg}`}>
            <card.icon className={`w-6 h-6 ${card.color}`} />
          </div>
        </div>
      ))}
    </div>
  );
}