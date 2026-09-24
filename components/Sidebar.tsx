// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DoorOpen, ShieldKeyhole, UserCog2, UserMinus } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

import { topNavItems, bottomNavItems } from "@/lib/mainMenuItems";
import ThemeToggle from "./ThemeToggle";
import UserAvatar from "./UserAvatar";
import { useConfirm } from "@/hooks/useConfirm";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const confirm = useConfirm();

  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const isImpersonating = session?.user?.impersonating === true;

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

  return (
    <aside className="w-16 bg-elevated dark:bg-sunken border-r border-subtle h-screen fixed left-0 top-0 flex flex-col pt-2 z-40 items-center overflow-y-auto transition-colors">
      {/* Logo */}
      <div className="align-center justify-center flex-col px-1.5">
        <ShieldKeyhole className="w-full h-12 text-brand dark:text-white" />
        <span className="text-[7px] -mt-3 text-brand dark:text-white font-mono">
          debit-board
        </span>
      </div>

      <span className="divide-x-2 border-b border-subtle w-full mb-2" />

      {/* Menu Principal (Topo) */}
      <nav className="flex-1 w-full space-y-1 flex flex-col items-center transition-all">
        {topNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-1 group hover:bg-sunken m-2 rounded-lg text-[9px] font-medium transition-colors w-full ${
                isActive ? "font-bold" : ""
              }`}
            >
              <item.icon
                className={`w-6 h-6 mb-1 group-hover:text-link ${
                  isActive ? "text-brand" : "text-muted"
                }`}
              />
              <span
                className={`text-center leading-tight group-hover:text-link ${
                  isActive ? "text-brand" : "text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bloco da Base (Wiki, Settings, Theme e Account) */}
      <div className="w-full flex flex-col items-center gap-0 m-0 relative">
        {bottomNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-3 px-1 group hover:bg-sunken rounded-lg text-[9px] font-medium transition-colors w-full ${
                isActive ? "font-bold" : ""
              }`}
            >
              <item.icon
                className={`w-6 h-6 mb-1 group-hover:text-link ${
                  isActive ? "text-brand" : "text-muted"
                }`}
              />
              <span
                className={`text-center leading-tight group-hover:text-link ${
                  isActive ? "text-brand" : "text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        <span className="divide-x-2 border-b border-subtle w-full mb-3" />

        <ThemeToggle />

        <span className="divide-x-2 border-b border-subtle w-full mt-3" />

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
              className="fixed bottom-4 left-16 z-[200] w-80 bg-elevated border border-subtle rounded-lg p-4 flex flex-col gap-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 pb-3 border-b border-subtle">
                <UserAvatar size={40} />
                <div className="px-2 overflow-hidden">
                  <p className="text-sm font-semibold truncate">
                    {session?.user?.name || "Usuário"}
                  </p>
                  <p className="text-xs text-mute font-thin truncate lowercase">
                    {session?.user?.email}
                  </p>
                  {isImpersonating && (
                    <span className="mt-1 inline-block text-[9px] border px-2 py-0.5 rounded-full">
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
