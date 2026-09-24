// app/settings/page.tsx
"use client";

import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { ArrowRight, Cog } from "lucide-react";
import { settingsMenuGroups } from "@/lib/settingsMenu";

export default function SettingsDashboardPage() {
  const { status, data: session } = useSession();

  if (status === "loading") {
    return (
      <div className="py-10 text-muted dark:text-muted">Carregando...</div>
    );
  }

  const isAdmin = session?.user?.isAdmin === true;
  const isImpersonating = session?.user?.impersonating === true;

  return (
    <div className="w-full space-y-8 mx-auto">
      <PageHeader
        title="Settings"
        icon={<Cog className="w-10 h-10 text-brand" />}
        subtitle={
          isImpersonating
            ? "Você está visualizando as configurações de outro usuário."
            : "Gerencie seu tenant e integrações."
        }
      />

      {settingsMenuGroups.map((group) => {
        if (group.adminOnly && !isAdmin) return null;

        return (
          <div key={group.label} className="space-y-4">
            <h2 className="text-sm font-bold text-muted dark:text-muted uppercase tracking-wider px-2">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.items.map((item) => (
                <Link
                  key={item.label.replace(/\s+/g, "-").toLowerCase()}
                  href={item.href}
                  className="group bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg p-5 hover:bg-page dark:hover:bg-surface/80 transition-all duration-200 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-apple-tertiary-light/10 rounded-lg text-muted dark:text-muted group-hover:text-brand transition-colors">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-heading dark:text-heading group-hover:text-brand transition-colors">
                        {item.label}
                      </h3>
                      <p className="text-xs text-muted dark:text-muted mt-1">
                        Acesse as configurações de {item.label.toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted dark:text-muted group-hover:text-heading dark:group-hover:text-heading transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
