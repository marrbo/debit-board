// components/Filters.tsx
'use client';

import { useMemo } from 'react';
import { SearchItem } from '@/lib/types';
import { Search } from 'lucide-react';
import { parseRepoName } from '@/lib/utils';

interface FiltersProps {
  allItems: SearchItem[];
  filteredItems: SearchItem[];
  disabled?: boolean;
  searchText: string;
  setSearchText: (text: string) => void;
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  selectedProject: string;
  setSelectedProject: (project: string) => void;
  selectedGerencia: string;
  setSelectedGerencia: (gerencia: string) => void;
  selectedNucleo: string;
  setSelectedNucleo: (nucleo: string) => void;
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  groupBy: string;
  setGroupBy: (group: string) => void;
  onSearch: () => void;
}

export default function Filters({
  allItems,
  searchText,
  setSearchText,
  searchQuery,
  setSearchQuery,
  selectedProject,
  setSelectedProject,
  selectedGerencia,
  setSelectedGerencia,
  selectedNucleo,
  setSelectedNucleo,
  selectedRepo,
  setSelectedRepo,
  groupBy,
  setGroupBy,
  onSearch,
}: FiltersProps) {
  
  const projects = useMemo(() => {
    return Array.from(new Set(allItems.map(i => i.project).filter(Boolean))).sort();
  }, [allItems]);

  const repos = useMemo(() => {
    return Array.from(new Set(allItems.map(i => i.repository).filter(Boolean))).sort();
  }, [allItems]);

  const gerencias = useMemo(() => {
    return Array.from(new Set(
      allItems
        .map(i => parseRepoName(i.repository).gerencia)
        .filter(g => g !== 'Sem Gerência')
    )).sort();
  }, [allItems]);

  const nucleos = useMemo(() => {
    return Array.from(new Set(
      allItems
        .map(i => parseRepoName(i.repository).nucleo)
        .filter(n => n !== 'Sem Núcleo')
    )).sort();
  }, [allItems]);

  return (
    <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 space-y-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-none transition-colors">
      {/* Busca API */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Query de Busca (Azure API)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Ex: ext:cs file:*Controller.cs AllowAnonymous OR NOT Authorize'
              className="flex-1 bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark placeholder:text-apple-tertiary-light dark:placeholder:text-apple-tertiary-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors"
            />
            <button
              onClick={onSearch}
              className="bg-apple-blue hover:bg-[#0063CE] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Filtros locais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-apple-border-light dark:border-apple-border-dark/50">
        <div className="md:col-span-1">
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Filtrar localmente por Nome
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-tertiary-light w-4 h-4" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Filtrar resultados..."
              className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl pl-9 pr-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark placeholder:text-apple-tertiary-light dark:placeholder:text-apple-tertiary-dark"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Projeto
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark"
          >
            <option value="">Todos</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Gerência
          </label>
          <select
            value={selectedGerencia}
            onChange={(e) => setSelectedGerencia(e.target.value)}
            className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark"
          >
            <option value="">Todas</option>
            {gerencias.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Núcleo
          </label>
          <select
            value={selectedNucleo}
            onChange={(e) => setSelectedNucleo(e.target.value)}
            className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark"
          >
            <option value="">Todos</option>
            {nucleos.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Repositório
          </label>
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark"
          >
            <option value="">Todos</option>
            {repos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-[10px] font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider mb-2">
            Agrupar Exibição Por
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark"
          >
            <option value="project-repo">Projeto → Repositório</option>
            <option value="gerencia-nucleo">Gerência → Núcleo</option>
            <option value="project">Apenas Projeto</option>
            <option value="repo">Apenas Repositório</option>
            <option value="flat">Sem Agrupamento</option>
          </select>
        </div>
      </div>
    </div>
  );
}