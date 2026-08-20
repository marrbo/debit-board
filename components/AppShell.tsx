// components/AppShell.tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Lista de páginas que NÃO devem ter a Sidebar
  const isPublicPage = pathname === '/login' || pathname.startsWith('/login');

  if (isPublicPage) {
    return (
      <div className="min-h-screen w-full bg-apple-bg-light dark:bg-apple-bg-dark flex flex-col transition-colors duration-200">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-apple-bg-light dark:bg-apple-bg-dark transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 w-full ml-20 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}