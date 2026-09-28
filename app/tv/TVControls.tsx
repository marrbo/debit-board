// app/tv/TVControls.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
} from "lucide-react";

const REFRESH_OPTIONS = [
  { value: 15, label: "15 segundos" },
  { value: 30, label: "30 segundos" },
  { value: 60, label: "1 minuto" },
  { value: 120, label: "2 minutos" },
  { value: 300, label: "5 minutos" },
  { value: 0, label: "Desativado" },
];

interface TVControlsProps {
  refreshSec: number;
  paused: boolean;
  secondsUntilRefresh: number | null;
  lastUpdate: Date | null;
  onTogglePause: () => void;
  cycleTeams: boolean;
  cycleableTeamCount: number;
  onToggleCycleTeams: () => void;
}

/**
 * Controles do modo TV: pausa, intervalo, fullscreen e ciclo de times.
 * O botão de ciclo só é exibido quando há 2+ times disponíveis.
 */
export default function TVControls({
  refreshSec,
  paused,
  secondsUntilRefresh,
  lastUpdate,
  onTogglePause,
  cycleTeams,
  cycleableTeamCount,
  onToggleCycleTeams,
}: TVControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleRefreshChange = (value: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 60) params.delete("refresh");
    else params.set("refresh", String(value));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error("Erro no fullscreen:", err);
    }
  };

  const activeOption =
    REFRESH_OPTIONS.find((o) => o.value === refreshSec) ?? REFRESH_OPTIONS[2];

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="hidden md:flex items-center gap-2 text-xs text-muted">
        <RefreshCw className="w-3.5 h-3.5" />
        <span>
          {lastUpdate
            ? `Atualizado às ${lastUpdate.toLocaleTimeString("pt-BR")}`
            : "Aguardando primeira carga"}
        </span>
        {!paused && secondsUntilRefresh !== null && refreshSec > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-sunken text-[10px] font-mono">
            {secondsUntilRefresh}s
          </span>
        )}
      </div>

      {cycleableTeamCount > 1 && (
        <button
          type="button"
          onClick={onToggleCycleTeams}
          title={cycleTeams ? "Parar ciclo de times" : "Ciclar entre times"}
          aria-pressed={cycleTeams}
          className={`btn-ghost ${cycleTeams ? "text-brand" : ""}`}
        >
          <Repeat className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onTogglePause}
        title={paused ? "Retomar atualizações" : "Pausar atualizações"}
        className="btn-ghost"
      >
        {paused ? (
          <Play className="w-4 h-4 text-success" />
        ) : (
          <Pause className="w-4 h-4" />
        )}
      </button>

      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-secondary"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted" />
          <span>{activeOption.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute right-0 mt-2 w-48 bg-sunken border border-default rounded-lg shadow-xl z-30 overflow-hidden"
          >
            {REFRESH_OPTIONS.map((opt) => {
              const active = opt.value === refreshSec;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleRefreshChange(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                    active
                      ? "text-brand font-medium bg-brand/5"
                      : "text-heading hover:bg-elevated"
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        className="btn-ghost"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
