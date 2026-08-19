// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  User, LogOut, UserMinus
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

// Importando a configuração centralizada
import { topNavItems, bottomNavItems } from '@/lib/mainMenuItems';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Verifica se o Admin está impersonando
  const isImpersonating = session?.user?.impersonating === true;

  const handleUnimpersonate = async () => {
    const res = await fetch('/api/admin/unimpersonate', { method: 'POST' });
    if (res.ok) {
      window.location.reload(); 
    } else {
      alert('Erro ao sair da impersonação.');
    }
    setIsAccountOpen(false);
  };

  const handleSignOut = () => {
    setIsAccountOpen(false);
    signOut({ callbackUrl: '/login' });
  };

  // Cores dinâmicas para o avatar (baseadas no nome)
  const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500'];
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  };
  const initial = (session?.user?.name || 'U').charAt(0).toUpperCase();

  return (
    <aside className="w-20 bg-[#1C1C1E] border-r border-[#38383A] h-screen fixed left-0 top-0 flex flex-col pt-6 pb-6 z-40 items-center overflow-y-auto transition-colors">
      {/* Logo (Azul Apple) */}
      <div className="mb-8">
        <div className="p-2 bg-[#007AFF] rounded-lg text-white">
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
            <path d="M12 26 C4 26 2 20 2 20 C2 20 4 14 12 14 C18 14 20 20 20 20 C20 20 18 26 12 26 Z" fill="#ffffff" opacity="0.8"/>
            <path d="M28 26 C36 26 38 20 38 20 C38 20 36 14 28 14 C22 14 20 20 20 20 C20 20 22 26 28 26 Z" fill="#ffffff" opacity="0.8"/>
            <circle cx="12" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
            <circle cx="28" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
          </svg>
        </div>
      </div>

      {/* Menu Principal (Topo) */}
      <nav className="flex-1 w-full space-y-2 flex flex-col items-center">
        {topNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-xl text-[9px] font-medium transition-colors w-full ${isActive ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'text-[#8E8E93] hover:bg-[#2C2C2E] hover:text-[#F5F5F7]'}`}
            >
              <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`} />
              <span className="text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 🔽 Bloco da Base (Wiki, Settings, Theme e Account) */}
      <div className="mt-auto w-full px-1.5 flex flex-col items-center gap-4 relative">
        
        {/* Items da Base (Wiki e Settings) */}
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[9px] font-medium transition-colors w-full ${isActive ? 'text-[#007AFF]' : 'text-[#8E8E93] hover:bg-[#2C2C2E] hover:text-[#F5F5F7]'}`}
            >
              <item.icon className={`w-5 h-5 mb-1 ${isActive ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`} />
              <span className="text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* 🌗 Theme Toggle */}
        <ThemeToggle />
        
        {/* Divisória Cinza Escura */}
        <div className="w-8 h-px bg-[#38383A]"></div>

        {/* 🚀 CORREÇÃO DEFINITIVA: O Popover agora usa `fixed` para flutuar fora da Sidebar */}
        <div className="w-full">
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[9px] font-medium text-[#8E8E93] hover:text-[#F5F5F7] transition-colors w-full cursor-pointer hover:bg-[#2C2C2E]"
          >
            <div className={`w-10 h-10 rounded-full ${getAvatarColor(session?.user?.name || 'U')} flex items-center justify-center text-sm text-white font-bold mb-1 shadow-md`}>
              {initial}
            </div>
            <span className="text-center leading-tight">Account</span>
          </button>

          {/* Popover Flutuante (Fora do fluxo da Sidebar) */}
          {isAccountOpen && (
            <div 
              className="fixed bottom-4 left-20 z-[200] w-56 bg-[#1C1C1E] border border-[#38383A] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-4 flex flex-col gap-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#38383A]">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(session?.user?.name || 'U')} flex items-center justify-center text-base text-[#F5F5F7] font-bold`}>
                  {initial}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-[#F5F5F7] truncate">{session?.user?.name || 'Usuário'}</p>
                  <p className="text-xs text-[#8E8E93] truncate lowercase">{session?.user?.email}</p>
                  {isImpersonating && (
                    <span className="mt-1 inline-block text-[9px] bg-[#AF52DE]/20 text-[#AF52DE] border border-[#AF52DE]/40 px-2 py-0.5 rounded-full">🔀 Impersonating</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Link
                  href="/settings/profile/user"
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8E8E93] hover:bg-[#2C2C2E] hover:text-[#F5F5F7] transition-colors"
                >
                  <span>User Settings</span>
                </Link>
                
                {isImpersonating ? (
                  <button
                    onClick={handleUnimpersonate}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#FF453A] hover:bg-[#2C2C2E] hover:text-[#FF453A] transition-colors text-left w-full"
                  >
                    <UserMinus className="w-4 h-4" /> Stop Impersonating
                  </button>
                ) : (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8E8E93] hover:bg-[#2C2C2E] hover:text-[#F5F5F7] transition-colors text-left w-full"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}