"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Users2Icon } from "lucide-react";
import { useTeam } from "@/hooks/useLocalSettings";

export interface TeamOption {
  _id: string;
  name: string;
  isGlobal?: boolean;
}

interface TeamSelectorProps {
  teams: TeamOption[];
  className?: string;
}

export default function TeamSelector({ teams, className }: TeamSelectorProps) {
  const [teamId, setTeamId] = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = teams.find((t) => t._id === teamId);

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between min-w-32 gap-2 bg-sunken border border-default dark:border-strong text-heading dark:text-heading px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none"
      >
        {selected?.isGlobal ? (
          <Globe className="w-3 h-3" />
        ) : (
          <Users2Icon className="w-3 h-3" />
        )}
        <span className="font-bold">{selected?.name}</span>
        <ChevronDown
          className={`w-4 h-4 justify-end transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-surface border border-default dark:border-strong rounded-lg shadow-sm hover:drop-shadow-lg z-20 overflow-hidden">
          {teams.map((team) => (
            <button
              key={team._id}
              onClick={() => {
                setTeamId(team._id);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-apple-tertiary-light/10 transition-colors ${
                teamId === team._id
                  ? "bg-apple-tertiary-light/5 font-semibold text-brand"
                  : "text-heading dark:text-heading"
              }`}
            >
              <span className="truncate">
                {team.isGlobal ? `${team.name} (Todos)` : team.name}
              </span>
              {teamId === team._id && <Check className="w-4 h-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
