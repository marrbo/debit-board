'use client';

import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Search, Check, Loader2 } from 'lucide-react';

export interface TenantUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface AssigneeSelectProps {
  currentAssignee?: TenantUser | null;
  onSelectAssignee: (user: TenantUser | null) => void;
}

export default function AssigneeSelect({
  currentAssignee = null,
  onSelectAssignee,
}: AssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Fechar o popover ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Buscar usuários do Tenant na API ao abrir
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        const data = await res.json();
        
        const rawUsers = data.users || data || [];

        // 🔥 A MÁGICA ACONTECE AQUI: Mapeamos o 'sub' (da API) para 'id' (do Componente)
        const mappedUsers: TenantUser[] = rawUsers.map((u: any) => ({
          id: u.sub || u._id,
          name: u.name || u.email || 'Usuário Desconhecido',
          email: u.email,
          avatarUrl: u.image || u.avatarUrl,
        }));

        setUsers(mappedUsers);
      } catch (err: any) {
        console.error('Erro ao carregar usuários:', err);
        setError('Não foi possível carregar os usuários.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (user: TenantUser | null) => {
    onSelectAssignee(user);
    setIsOpen(false);
  };

  return (
    <div ref={popoverRef} className="relative inline-block text-left">
      {/* Botão Gatilho (Exibido na célula da tabela) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-apple-border-light/30 dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
        title="Alterar Assignee"
      >
        {currentAssignee ? (
          <div className="flex items-center gap-2">
            {currentAssignee.avatarUrl ? (
              <img
                src={currentAssignee.avatarUrl}
                alt={currentAssignee.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-apple-blue/10 text-apple-blue font-semibold text-[11px] flex items-center justify-center">
                {currentAssignee.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-medium text-apple-label-light dark:text-apple-label-dark max-w-[110px] truncate">
              {currentAssignee.name}
            </span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <UserIcon className="w-4 h-4" />
          </div>
        )}
      </button>

      {/* Popover Flutuante */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-2xl z-[9999] p-3 flex flex-col gap-3 font-sans">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-apple-border-light dark:border-apple-border-dark pb-2">
            <span className="text-xs font-bold text-apple-label-light dark:text-apple-label-dark">
              Assignee
            </span>
            {currentAssignee && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-[11px] font-medium text-apple-tertiary-light hover:text-apple-red transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Campo de Busca */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-apple-tertiary-light pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark placeholder:text-apple-tertiary-light"
              autoFocus
            />
          </div>

          {/* Lista de Usuários */}
          <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-apple-tertiary-light">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-xs">Buscando usuários...</span>
              </div>
            ) : error ? (
              <div className="text-xs text-apple-red text-center py-4">{error}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-xs text-apple-tertiary-light text-center py-4">
                Nenhum usuário encontrado.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = currentAssignee?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelect(user)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-apple-blue/10 text-apple-blue font-semibold'
                        : 'hover:bg-apple-border-light/30 dark:hover:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-apple-border-light dark:bg-[#3A3A3C] text-apple-label-light dark:text-apple-label-dark font-medium text-[10px] flex items-center justify-center shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{user.name}</span>
                        {user.email && (
                          <span className="text-[10px] text-apple-tertiary-light truncate">
                            {user.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-apple-blue" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}