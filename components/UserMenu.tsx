// components/UserMenu.tsx
'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { User, LogOut, Settings, UserMinus } from 'lucide-react';
import Link from 'next/link';

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const isImpersonating = session?.user?.impersonating === true;

  const handleUnimpersonate = async () => {
    const res = await fetch('/api/admin/unimpersonate', { method: 'POST' });
    if (res.ok) {
      window.location.reload(); 
    } else {
      alert('Erro ao sair da impersonação.');
    }
    setIsOpen(false);
  };

  if (!session) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-xl p-1 pr-3 transition-colors border ${isImpersonating ? 'bg-[#AF52DE]/20 border-[#AF52DE]' : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] border-apple-border-light dark:border-apple-border-dark hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C]'}`}
      >
        <div className="w-8 h-8 rounded-full bg-apple-blue flex items-center justify-center text-white font-bold text-sm">
          {session.user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="text-sm text-apple-label-light dark:text-apple-label-dark hidden md:block max-w-[100px] truncate">
          {session.user?.name || 'Usuário'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-64 bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden z-50 py-1 transition-colors">
          <div className="px-4 py-3 border-b border-apple-border-light dark:border-apple-border-dark">
            <p className="text-sm font-medium text-apple-label-light dark:text-apple-label-dark">{session.user?.name}</p>
            <p className="text-xs text-apple-tertiary-light truncate">{session.user?.email}</p>
            {isImpersonating && (
              <div className="mt-2 inline-block bg-[#AF52DE]/20 text-[#AF52DE] border border-[#AF52DE]/40 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                🔀 Impersonando
              </div>
            )}
          </div>
          
          {isImpersonating ? (
            <button
              onClick={handleUnimpersonate}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-apple-red hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] hover:text-[#FF453A] transition-colors text-left border-t border-apple-border-light dark:border-apple-border-dark mt-1"
            >
              <UserMinus className="w-4 h-4" /> Sair da Impersonação
            </button>
          ) : (
            <>
              <Link 
                href="/settings" 
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-apple-secondary-light dark:text-apple-secondary-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] hover:text-apple-label-light dark:hover:text-apple-label-dark transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Settings className="w-4 h-4" /> Configurações
              </Link>

              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: '/login' });
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-apple-red hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] hover:text-[#FF453A] transition-colors text-left border-t border-apple-border-light dark:border-apple-border-dark mt-1"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}