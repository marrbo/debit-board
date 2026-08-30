'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { settingsMenuGroups } from '@/lib/settingsMenu';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  // Após autenticação, define se é admin
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isAdmin) {
      setIsAdmin(true);
    }
  }, [status, session]);

  // Enquanto carrega sessão, não renderiza grupo admin (evita mismatch)
  const showAdminGroup = status === 'authenticated' && isAdmin;

  return (
    <div className="flex flex-col md:flex-row w-full p-8 gap-6 mx-auto transition-colors duration-200">
      {/* Sub-Sidebar de Settings */}
      <div className="w-full md:w-52 shrink-0 space-y-6">
        {/* Segurança: só renderiza grupo admin se confirmado */}
        {settingsMenuGroups.map((group) => {
          if (group.adminOnly && !showAdminGroup) {
            return null;
          }

          return (
            <div key={group.label} className="space-y-1">
              <div className="text-xs font-bold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider px-3 pt-2 pb-2">
                {group.label}
              </div>

              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-apple-blue/10 text-apple-blue'
                        : 'text-apple-tertiary-light dark:text-apple-tertiary-dark hover:bg-apple-card-light dark:hover:bg-apple-card-dark hover:text-apple-label-light dark:hover:text-apple-label-dark'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-apple-blue' : 'text-apple-tertiary-light dark:text-apple-tertiary-dark'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Conteúdo da página */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}