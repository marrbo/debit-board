'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { settingsMenuGroups } from '@/lib/settingsMenu';

export default function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {settingsMenuGroups.map((group) => {
        if (group.adminOnly && !isAdmin) return null;

        return (
          <div key={group.label} className="space-y-1">
            <div className="text-xs font-bold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider px-3 pt-2 pb-2">
              {group.label}
            </div>
            {group.items.map((item, index) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={`${group.label}-${index}`}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive ? 'bg-apple-blue/10 text-apple-blue' : 'text-apple-tertiary-light dark:text-apple-tertiary-dark hover:bg-apple-card-light dark:hover:bg-apple-card-dark'
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
    </>
  );
}
