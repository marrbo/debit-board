// app/settings/SettingsNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAVIGATION, SETTINGS_GROUP_ORDER } from "@/lib/navigation";
import { useLocalSetting } from "@/hooks/useLocalSettings";

/**
 * Sub-navegação de `/settings/*`. Consome `NAVIGATION` (slot
 * `settings`), agrupado por `group` na ordem canônica definida em
 * `SETTINGS_GROUP_ORDER`.
 */
export default function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [settingsNav, setSettingsNav] = useLocalSetting("settingsNav");

  const grouped = SETTINGS_GROUP_ORDER.map((group) => ({
    label: group,
    items: NAVIGATION.filter(
      (i) =>
        i.slot === "settings" && i.group === group && (!i.adminOnly || isAdmin),
    ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={`relative -mt-3 flex flex-col h-full transition-all duration-300 ease-in-out bg-sunken dark:bg-black/20 text-heading border-r border-strong ${
        settingsNav ? "w-4" : "w-76"
      }`}
    >
      <div
        className={`absolute top-7 z-20 bg-sunken p-1 rounded-sm transition-all ${
          settingsNav ? "-right-3.5" : "right-3"
        }`}
      >
        <button
          onClick={() => setSettingsNav(!settingsNav)}
          className={`flex p-0 items-center hover:!bg-transparent justify-center w-4 h-4 rounded-lg text-muted hover:text-brand transition-all ${
            settingsNav ? "bg-sunken" : ""
          }`}
          title={settingsNav ? "Expandir menu" : "Recolher menu"}
        >
          {settingsNav ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {!settingsNav && (
        <div className="flex-1 overflow-y-auto py-6 pr-10 pl-4">
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider px-3 py-2 mb-3">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  if (item.disabled) {
                    return (
                      <span
                        key={item.href + item.label}
                        className="flex group items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted/50 cursor-not-allowed"
                        title="Em breve"
                      >
                        <Icon className="w-5 h-5 group-hover:text-brand" />
                        {item.label}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center group gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-muted hover:bg-surface dark:hover:bg-surface"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 group-hover:text-brand ${
                          isActive ? "text-brand" : "text-muted"
                        }`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {settingsNav && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6" />
      )}
    </div>
  );
}
