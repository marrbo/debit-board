// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DoorOpen, UserCog2, UserMinus } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useMemo, useState } from "react";

import { NAVIGATION } from "@/lib/navigation";
import ThemeToggle from "./ThemeToggle";
import UserAvatar from "./UserAvatar";
import { useConfirm } from "@/hooks/useConfirm";
import { usePermissions } from "@/hooks/usePermissions";
import DebitBoardLogo from "./brand/DebitBoardLogo";

/**
 * Sidebar principal. Consome `NAVIGATION` (slots `primary` e
 * `secondary`) — a lista de rotas, ícones e labels vive em um único
 * lugar.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const confirm = useConfirm();

  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const isImpersonating = session?.user?.impersonating === true;
  const { isAdmin, canAccess } = usePermissions();

  const primaryItems = useMemo(
    () =>
      NAVIGATION.filter(
        (i) =>
          i.slot === "primary" &&
          (!i.adminOnly || isAdmin) &&
          canAccess(i.requiredRoles),
      ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [isAdmin, canAccess],
  );

  const secondaryItems = useMemo(
    () =>
      NAVIGATION.filter(
        (i) =>
          i.slot === "secondary" &&
          (!i.adminOnly || isAdmin) &&
          canAccess(i.requiredRoles),
      ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [isAdmin, canAccess],
  );

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const handleUnimpersonate = async () => {
    setIsAccountOpen(false);

    const ok = await confirm({
      title: "Encerrar impersonação",
      message:
        "Deseja encerrar a impersonação e voltar à sua conta de administrador?\nEsta janela será fechada.",
      confirmLabel: "Encerrar",
      confirmColor: "warning",
      action: async () => {
        const res = await fetch("/api/admin/unimpersonate", { method: "POST" });
        if (!res.ok) throw new Error("Falha ao encerrar a impersonação.");

        if (window.opener && !window.opener.closed) {
          window.close();
        } else {
          window.location.href = "/settings/admin";
        }
      },
    });
    if (!ok) return;
  };

  const handleSignOut = () => {
    setIsAccountOpen(false);
    signOut({ callbackUrl: "/login" });
  };

  const renderNavLink = (item: (typeof NAVIGATION)[number]) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex flex-col items-center justify-center font-mono font-thin py-4 px-1 group hover:bg-elevated m-1 rounded-md text-[9px] transition-colors w-full ${
          active ? "font-bold" : ""
        }`}
      >
        <Icon
          className={`w-6 h-6 mb-1 group-hover:text-link ${
            active ? "text-brand" : "text-muted"
          }`}
        />
        {item.label && (
          <span
            className={`text-center leading-tight group-hover:text-link ${
              active ? "text-brand" : "text-muted"
            }`}
          >
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-16 bg-page bg-gradient-to-b from-elevated dark:from-sunken via-page dark:via-page to-elevated dark:to-sunken transition-color h-screen fixed left-0 top-0 flex flex-col pt-2 z-40 items-center overflow-y-auto transition-colors">
      {/* Logo */}
      <div className="flex-col px-1.5 text-brand dark:text-white font-mono align-center hover:animate-pulse cursor-pointer">
        {/* <ShieldKeyhole className="w-full h-12 text-brand dark:text-white" /> */}
        <div className="justify-beteween flex mb-1">
          <DebitBoardLogo size={48} />
        </div>
        <div className="text-[7px] text-center">Debit-Board</div>
      </div>

      <span className="divide-x-2 w-full mb-4" />

      {/* Menu Principal (Topo) */}
      <nav className="flex-1 w-full space-y-1 flex flex-col items-center transition-all">
        {primaryItems.map(renderNavLink)}
      </nav>

      {/* Bloco da Base (Wiki, Settings, Theme e Account) */}
      <div className="w-full flex flex-col items-center gap-0 m-0 relative">
        {secondaryItems.map(renderNavLink)}

        <span className="divide-x-2 w-full mb-3" />

        <ThemeToggle />

        <span className="divide-x-2 w-full mt-3" />

        {/* Usuário */}
        <div className="w-16 m-0">
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="flex flex-col p-0 pt-2 items-center group justify-center text-[9px] font-medium transition-colors w-16"
          >
            <UserAvatar size={40} className="mb-2" />
          </button>

          {isAccountOpen && (
            <div
              className="fixed bottom-4 left-16 z-[200] w-80 bg-elevated border border-subtle rounded-md p-1 flex flex-col gap-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 pb-3 border-b border-subtle">
                <UserAvatar size={40} />
                <div className="px-2 overflow-hidden">
                  <p className="text-sm font-semibold truncate">
                    {session?.user?.name || "Usuário"}
                  </p>
                  <p className="text-xs text-muted font-thin truncate lowercase">
                    {session?.user?.email}
                  </p>
                  {isImpersonating && (
                    <span className="mt-1 inline-block text-[9px] border px-2 py-0.5 rounded-md">
                      🔀 Impersonating
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Link
                  href="/settings/profile/user"
                  role="button"
                  onClick={() => setIsAccountOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted transition-colors text-left w-full"
                >
                  <UserCog2 className="w-4 h-4" /> User Settings
                </Link>

                {isImpersonating ? (
                  <button
                    onClick={handleUnimpersonate}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted transition-colors text-left w-full"
                  >
                    <UserMinus className="w-4 h-4" /> Stop Impersonating
                  </button>
                ) : (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted transition-colors text-left w-full"
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
