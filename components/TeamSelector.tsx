// components/TeamSelector.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe, Layers } from "lucide-react";
import HeaderActions from "@/components/PageHeader/HeaderActions";
import { useTeam } from "@/hooks/useLocalSettings";

export interface TeamOption {
  _id: string;
  name: string;
  isGlobal?: boolean;
  /** Populado por `/api/teams` — usado para filtrar times vazios em TV. */
  projectCount?: number;
}

interface TeamSelectorProps {
  teams: TeamOption[];
  className?: string;
}

/**
 * Seletor de time — versão compacta (icon-only).
 *
 * Ícones:
 *  - **Global**: `Globe` — "todos os times".
 *  - **Time específico**: `Layers` — agrupamento de projetos. Não usa
 *    ícones de pessoa (`Users`) para não colidir com o avatar/menu de
 *    usuário no canto do header.
 *
 * O nome do time ativo aparece no tooltip e no subtítulo do `PageHeader`
 * (via caller) — mantém a barra discreta sem esconder contexto.
 */
export default function TeamSelector({ teams, className }: TeamSelectorProps) {
  const [teamId, setTeamId] = useTeam();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = teams.find((t) => t._id === teamId);
  const tooltip = `Time: ${selected?.name ?? "—"}`;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <HeaderActions
        tooltip={tooltip}
        color="info"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        isActive={open}
      >
        {selected?.isGlobal ? <Globe /> : <Layers />}
      </HeaderActions>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-sunken border border-default rounded-lg shadow-xl z-30 overflow-hidden">
          <ul className="py-1 max-h-72 overflow-y-auto">
            {teams.map((team) => {
              const isActive = teamId === team._id;
              return (
                <li key={team._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamId(team._id);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? "text-brand font-medium bg-brand/5"
                        : "text-heading hover:bg-elevated"
                    }`}
                  >
                    <span className="truncate">
                      {team.isGlobal ? `${team.name} (Todos)` : team.name}
                    </span>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
