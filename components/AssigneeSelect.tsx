'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Image from 'next/image';
import type { IUser } from '@/types/IUser';

interface AssigneeSelectProps {
  users: IUser[];
  value?: string;
  onChange: (value: string | null) => void;
  className?: string;
}

export default function AssigneeSelect({ users, value, onChange, className = "" }: AssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUpwards: false });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 300; // Altura estimada do dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // ✅ LÓGICA DE POSIÇÃO: Se não houver espaço abaixo, abre para cima
      const shouldOpenUpwards = spaceBelow < dropdownHeight;

      setCoords({
        top: shouldOpenUpwards 
          ? rect.top + window.scrollY - dropdownHeight 
          : rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        openUpwards: shouldOpenUpwards,
      });
    }
    setIsOpen(!isOpen);
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find(u => u.sub === value);

  // ✅ FALLBACK DE IMAGEM: Lógica idêntica ao ProjectDrawer
  const getAvatarUrl = (user?: IUser) => {
    if (user?.avatar) return user.avatar;
    const name = user?.name || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&length=2&background=0D8ABC&color=fff&width=28&height=28`;
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* BOTÃO GATILHO: */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative group focus:outline-none"
      >
        <Image 
          src={getAvatarUrl(selectedUser)} 
          alt="Assignee" 
          width={28}
          height={28}
          className="w-7 h-7 rounded-full border-2 border-transparent group-hover:border-apple-blue transition-all object-cover"
        />
        {/* Tooltip simples para indicar que é clicável */}
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Atribuir Responsável
        </span>
      </button>

      {/* DROPDOWN VIA PORTAL */}
      {isOpen && createPortal(
        <div 
          className="fixed z-[9999] w-64 bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-2xl overflow-hidden"
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            position: 'absolute' 
          }}
        >
          <div className="p-2 border-b border-apple-border-light dark:border-apple-border-dark">
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3 h-3 text-apple-tertiary-light" />
              <input
                autoFocus
                className="w-full pl-7 pr-2 py-1 text-xs bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-lg focus:outline-none"
                placeholder="Buscar usuários..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <button
                  key={user.sub}
                  onClick={() => { onChange(user.sub); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 hover:bg-apple-blue/10 rounded-lg transition-colors text-left"
                >
                  <Image 
                    src={getAvatarUrl(user)} 
                    width={28}
                    height={28}
                    className="w-6 h-6 rounded-full object-cover" 
                    alt={user.name} 
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-medium truncate">{user.name}</span>
                    <span className="text-[10px] text-apple-tertiary-light truncate">{user.email}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-apple-tertiary-light">
                Nenhum usuário encontrado.
              </div>
            )}
            <button 
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="w-full text-left px-2 py-2 text-xs text-apple-red hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Limpar Responsável
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
