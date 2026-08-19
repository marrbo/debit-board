// components/ProjectSelect.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, FolderGit2 } from 'lucide-react';

interface ProjectSelectProps {
  projects: { _id: string; name: string }[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export default function ProjectSelect({ projects, selectedId, onChange, placeholder = 'All Projects (Global)' }: ProjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = selectedId === 'all' 
    ? placeholder 
    : projects.find(p => p._id === selectedId)?.name || placeholder;

  return (
    <div className="relative w-full md:w-64" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30 shadow-sm"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-apple-tertiary-light transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full min-w-[240px] bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-50 p-2 overflow-hidden">
          
          <div className="relative mb-2 border-b border-apple-border-light dark:border-apple-border-dark pb-2">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-apple-tertiary-light" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl pl-8 pr-3 py-1.5 text-xs text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-1 focus:ring-apple-blue"
            />
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1">
            <button
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-left transition-colors ${selectedId === 'all' ? 'bg-apple-blue/10 text-apple-blue' : 'text-apple-secondary-light dark:text-apple-secondary-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'}`}
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0 text-apple-tertiary-light" />
              <span>All Projects (Global)</span>
              {selectedId === 'all' && <Check className="w-3.5 h-3.5 ml-auto text-apple-blue" />}
            </button>

            {filteredProjects.length === 0 && searchTerm && (
              <div className="px-2 py-2 text-xs text-apple-tertiary-light text-center">Nenhum projeto encontrado.</div>
            )}

            {filteredProjects.map((p) => (
              <button
                key={p._id}
                onClick={() => { onChange(p._id); setIsOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-left transition-colors ${selectedId === p._id ? 'bg-apple-blue/10 text-apple-blue' : 'text-apple-secondary-light dark:text-apple-secondary-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'}`}
              >
                <div className="w-5 h-5 rounded bg-[#F2F2F7] dark:bg-[#38383A] flex items-center justify-center text-[8px] text-apple-label-light dark:text-apple-label-dark font-bold shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{p.name}</span>
                {selectedId === p._id && <Check className="w-3.5 h-3.5 ml-auto text-apple-blue" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}