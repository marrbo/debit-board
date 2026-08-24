"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Check, User, SearchCode } from "lucide-react";

interface AssigneeSelectProps {
  users: any[];
  value?: string | null;
  onChange: (userId: string | null) => void;
  className?: string;
}

export default function AssigneeSelect({
  users = [],
  value = null,
  onChange,
  className = "",
}: AssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredUsers = users.filter((u) => {
    const name = u.name || u.email || "";
    const email = u.email || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setIsOpen(false);
  };

  const currentUser = users.find((u) => (u.sub || u.id || u._id) === value);
  const userName = currentUser
    ? currentUser.name || currentUser.email || "Desconhecido"
    : "";
  const sub = currentUser
    ? currentUser.sub || currentUser.id || currentUser._id
    : "";

  const colors = [
    "bg-blue-600",
    "bg-red-600",
    "bg-emerald-600",
    "bg-purple-600",
    "bg-amber-600",
    "bg-pink-600",
  ];
  const colorIndex = (sub || userName || "").length % colors.length;
  const initial = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <div
      ref={popoverRef}
      className={`relative align-middle text-center ${className}`}
    >
      {/* Gatilho Integrado: Exibe o Avatar/Nome se atribuído ou o botão tracejado se vazio */}
      {currentUser ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 group focus:outline-none text-left"
          title="Alterar responsável"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${colors[colorIndex]}`}
          >
            {initial}
          </div>
          <span className="text-xs font-medium text-apple-label-light dark:text-apple-label-dark truncate max-w-[90px] group-hover:text-apple-blue transition-colors">
            {userName}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-8 h-8 rounded-full bg-apple-border-light/50 dark:bg-[#2C2C2E] flex items-center justify-center border border-dashed border-apple-tertiary-light/50 hover:border-apple-blue hover:bg-apple-blue/10 transition-all focus:outline-none"
          title="Atribuir responsável"
        >
          <User className="w-3.5 h-3.5 text-apple-tertiary-light" />
        </button>
      )}

      {/* Popover Flutuante */}
      {isOpen && (
        <div className="absolute righ-250 top-full mt-2 w-72 bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-2xl z-[9999] p-3 flex flex-col gap-3 font-sans">
          <div className="flex items-center justify-between border-b border-apple-border-light dark:border-apple-border-dark pb-2">
            <span className="text-xs font-bold text-apple-label-light dark:text-apple-label-dark">
              Atribuir Responsável
            </span>
            {value && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-[11px] font-medium text-apple-tertiary-light hover:text-apple-red transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            <SearchCode className="w-3.5 h-3.5 absolute left-3 text-apple-tertiary-light pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuários..."
              className="w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark placeholder:text-apple-tertiary-light"
              autoFocus
            />
          </div>

          <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
            {filteredUsers.length === 0 ? (
              <div className="text-xs text-apple-tertiary-light text-center py-4">
                Nenhum usuário encontrado.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const userId = u.sub || u.id || u._id;
                const isSelected = value === userId;
                const uName = u.name || u.email || "Desconhecido";
                const uSub = u.sub || userId;
                const uColorIndex =
                  (uSub || uName || "").length % colors.length;

                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => handleSelect(userId)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors text-left ${
                      isSelected
                        ? "bg-apple-blue/10 text-apple-blue font-semibold"
                        : "hover:bg-apple-border-light/30 dark:hover:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full text-white font-medium text-[10px] flex items-center justify-center shrink-0 ${colors[uColorIndex]}`}
                      >
                        {uName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{uName}</span>
                        {u.email && (
                          <span className="text-[10px] text-apple-tertiary-light truncate">
                            {u.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 text-apple-blue" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
