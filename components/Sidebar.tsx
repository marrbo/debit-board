// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DoorOpen, ShieldKeyhole, UserCog2, UserMinus } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import Image from 'next/image';

// Importando a configuração centralizada
import { topNavItems, bottomNavItems } from '@/lib/mainMenuItems';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const getFirstName = () => {
    if (session?.user?.firstName) return session?.user?.firstName;
    return session?.user?.name.trim().split(' ')[0]
  }

  const getAvatarUrl = () => {
      if (session?.user?.avatar) return session?.user?.avatar;
      const name = session?.user?.name || 'U';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&length=2&background=b62539&color=fff&width=32&height=32`;
    };

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

  return (
    <aside className="w-20 bg-surface dark:bg-sunken border-r border-subtle h-screen fixed left-0 top-0 flex flex-col pt-2 pb-2 z-40 items-center overflow-y-auto transition-colors">
      {/* Logo */}
      <div className="align-center flex-col space-y-0 h-[85px]">
        <div className="bg-brand rounded-lg p-2 text-page items-center flex justify-center">
          <ShieldKeyhole className='w-10 h-10'/>
        </div>
        <span className='text-[9px] text-brand font-mono'>debit-board</span>
      </div>
      
      <span className="divide-x-2 border-b border-sunken w-full mb-4"/>

      {/* Menu Principal (Topo) */}
      <nav className="flex-1 w-full px-1.5 space-y-1 flex flex-col items-center">
        {topNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-1 group hover:bg-sunken m-2 rounded-xl text-[9px] font-medium transition-colors w-full ${isActive ? 'border border-brand font-bold'   : ''}`}
            >
              <item.icon className={`w-6 h-6 mb-1 group-hover:text-link ${isActive ? 'text-brand w-8 h-8' : 'text-muted'}`} />
              <span className={`text-center leading-tight group-hover:text-link ${isActive ? 'text-brand' : 'text-muted'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 🔽 Bloco da Base (Wiki, Settings, Theme e Account) */}
      <div className="w-full flex flex-col items-center gap-0 h-30 px-1.5 relative">
        <span className={`divide-x-2 border-b border-sunken w-full`}/>
        {/* Items da Base (Wiki e Settings) */}
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-1 group hover:bg-sunken m-2 rounded-xl text-[9px] font-medium transition-colors w-full ${isActive ? 'border border-brand bg-page font-bold'   : ''}`}
            >
              <item.icon className={`w-6 h-6 mb-1 group-hover:text-link ${isActive ? 'text-brand w-8 h-8' : 'text-muted'}`} />
              <span className={`text-center leading-tight group-hover:text-link ${isActive ? 'text-brand' : 'text-muted'}`}>{item.label}</span>
            </Link>
          );
        })}

        <span className="divide-x-2 border-b border-sunken w-full mb-4"/>

        {/* 🌗 Theme Toggle */}
        <ThemeToggle />
        
        {/* Divisória Cinza Escura */}
        <div className="w-full h-px mt-4 mb-2 bg-sunken"></div>

        {/* 🚀 CORREÇÃO DEFINITIVA: O Popover agora usa `fixed` para flutuar fora da Sidebar */}
        <div className="w-full">
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[9px] font-medium text-muted hover:text-link transition-colors w-full cursor-pointer hover:bg-brand"
          >
            <Image 
              src={getAvatarUrl()} 
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover mb-2" 
              alt={`${session?.user?.name || 'avatar'}`}
            />
            <span className="text-center leading-tight">{getFirstName()}</span>
          </button>

          {/* Popover Flutuante (Fora do fluxo da Sidebar) */}
          {isAccountOpen && (
            <div 
              className="fixed bottom-4 left-20 z-[200] w-80 bg-elevated border border-subtle rounded-2xl shadow-sm hover:drop-shadow-lg drop-shadow-sm hover:drop-shadow-lg p-4 flex flex-col gap-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-3 border-b border-subtle">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base text-body font-bold`}>
                  <Image 
                    src={getAvatarUrl()} 
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover mb-2" 
                    alt={`${session?.user?.name || 'avatar'}`}
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-body truncate">{session?.user?.name || 'Usuário'}</p>
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
                  <UserCog2 className="w-4 h-4" /> User Settings
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
                    <DoorOpen className="w-4 h-4" /> Sign Out
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