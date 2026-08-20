// app/settings/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { settingsMenuItems } from '@/lib/settingsMenu';

export default function SettingsDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redireciona para a primeira aba por padrão, estilo Sentry
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/settings');
    }
  }, [status, router]);

  if (status === 'loading') return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;

  return (
    <div className="w-full space-y-6 mx-auto">
      <PageHeader title="Settings" subtitle="Gerencie seu tenant e integrações." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsMenuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-all duration-200 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-apple-tertiary-light/10 rounded-xl text-apple-tertiary-light dark:text-apple-tertiary-dark group-hover:text-apple-blue transition-colors">
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-apple-label-light dark:text-apple-label-dark group-hover:text-apple-blue transition-colors">{item.label}</h3>
                <p className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark mt-1">{item.label}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-apple-tertiary-light dark:text-apple-tertiary-dark group-hover:text-apple-label-light dark:group-hover:text-apple-label-dark transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}