// app/settings/page.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader/Header";
import { NAVIGATION, SETTINGS_GROUP_ORDER } from "@/lib/navigation";
import { getServerAuthSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * Landing de `/settings` — grade de cards para cada sub-rota.
 *
 * Server component: o layout já chama `getServerAuthSession` para
 * checar `isAdmin`; aqui reusamos a mesma sessão sem novo round-trip
 * para o client.
 */
export default async function SettingsDashboardPage() {
  const session = await getServerAuthSession();
  const isAdmin = session?.user?.isAdmin === true;
  const isImpersonating = session?.user?.impersonating === true;

  const grouped = SETTINGS_GROUP_ORDER.map((group) => ({
    label: group,
    items: NAVIGATION.filter(
      (i) =>
        i.slot === "settings" &&
        i.group === group &&
        !i.disabled &&
        (!i.adminOnly || isAdmin),
    ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-full space-y-8 mx-auto">
      <PageHeader
        subtitle={
          isImpersonating
            ? "Você está visualizando as configurações de outro usuário."
            : undefined
        }
      />

      {grouped.map((group) => (
        <section key={group.label} className="space-y-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider px-2">
            {group.label}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group card dark:border-none p-5 flex items-center justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-brand/5 text-muted group-hover:text-brand transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-heading group-hover:text-brand transition-colors">
                        {item.label}
                      </h3>
                      {item.subtitle && (
                        <p className="text-xs text-muted mt-1">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-heading transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
