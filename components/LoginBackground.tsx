// components/LoginBackground.tsx
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldHalf,
  Lock,
  FileLock2,
  Key,
  KeyRound,
  Fingerprint,
  EyeOff,
  ScanFace,
  ScanLine,
  Network,
  Server,
  Cpu,
} from "lucide-react";

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { strokeWidth?: number }
>;

type IconSpec = {
  Icon: IconComponent;
  x: number;
  y: number;
  size: number;
  rotate: number;
  duration: number;
  delay: number;
  variant: "slow" | "fast";
  hideOnMobile?: boolean;
  tint?: "blue" | "cyan" | "violet";
  /**
   * Intensidade do parallax. Valores baixos = parece "longe" (move pouco);
   * valores altos = parece "perto" (move muito). Range recomendado: 0.2 – 1.5
   */
  depth: number;
};

const ICONS: IconSpec[] = [
  // Canto superior esquerdo
  {
    Icon: ShieldCheck,
    x: 4,
    y: 8,
    size: 88,
    rotate: -12,
    duration: 28,
    delay: 0,
    variant: "slow",
    tint: "blue",
    depth: 0.6,
  },
  {
    Icon: Lock,
    x: 12,
    y: 22,
    size: 52,
    rotate: 9,
    duration: 22,
    delay: 1.5,
    variant: "fast",
    tint: "cyan",
    depth: 1.1,
  },
  {
    Icon: Fingerprint,
    x: 6,
    y: 44,
    size: 64,
    rotate: -6,
    duration: 32,
    delay: 3,
    variant: "slow",
    tint: "violet",
    depth: 0.4,
  },
  {
    Icon: KeyRound,
    x: 14,
    y: 66,
    size: 46,
    rotate: 14,
    duration: 24,
    delay: 0.8,
    variant: "fast",
    tint: "blue",
    depth: 1.3,
  },
  {
    Icon: ScanFace,
    x: 5,
    y: 84,
    size: 70,
    rotate: -8,
    duration: 30,
    delay: 2.2,
    variant: "slow",
    tint: "cyan",
    depth: 0.5,
  },
  {
    Icon: Network,
    x: 22,
    y: 6,
    size: 44,
    rotate: 16,
    duration: 26,
    delay: 4,
    variant: "fast",
    hideOnMobile: true,
    tint: "violet",
    depth: 0.9,
  },
  {
    Icon: Key,
    x: 26,
    y: 88,
    size: 40,
    rotate: -14,
    duration: 20,
    delay: 1,
    variant: "fast",
    hideOnMobile: true,
    tint: "blue",
    depth: 1.2,
  },

  // Canto superior direito
  {
    Icon: Shield,
    x: 92,
    y: 10,
    size: 84,
    rotate: 10,
    duration: 30,
    delay: 0.5,
    variant: "slow",
    tint: "cyan",
    depth: 0.7,
  },
  {
    Icon: EyeOff,
    x: 86,
    y: 28,
    size: 50,
    rotate: -12,
    duration: 24,
    delay: 2,
    variant: "fast",
    tint: "blue",
    depth: 1.0,
  },
  {
    Icon: FileLock2,
    x: 94,
    y: 48,
    size: 66,
    rotate: 7,
    duration: 28,
    delay: 3.5,
    variant: "slow",
    tint: "violet",
    depth: 0.45,
  },
  {
    Icon: ShieldAlert,
    x: 82,
    y: 70,
    size: 44,
    rotate: -16,
    duration: 22,
    delay: 1.2,
    variant: "fast",
    tint: "cyan",
    depth: 1.15,
  },
  {
    Icon: ShieldHalf,
    x: 90,
    y: 88,
    size: 72,
    rotate: 12,
    duration: 34,
    delay: 4.5,
    variant: "slow",
    tint: "blue",
    depth: 0.55,
  },
  {
    Icon: Server,
    x: 74,
    y: 5,
    size: 40,
    rotate: -8,
    duration: 26,
    delay: 2.5,
    variant: "fast",
    hideOnMobile: true,
    tint: "violet",
    depth: 1.05,
  },
  {
    Icon: Cpu,
    x: 78,
    y: 92,
    size: 42,
    rotate: 10,
    duration: 24,
    delay: 3.8,
    variant: "fast",
    hideOnMobile: true,
    tint: "cyan",
    depth: 0.85,
  },

  // Topo/base centrais
  {
    Icon: ScanLine,
    x: 50,
    y: 3,
    size: 36,
    rotate: -4,
    duration: 28,
    delay: 1.8,
    variant: "fast",
    hideOnMobile: true,
    tint: "blue",
    depth: 1.4,
  },
  {
    Icon: Key,
    x: 50,
    y: 96,
    size: 38,
    rotate: 6,
    duration: 26,
    delay: 4.2,
    variant: "fast",
    hideOnMobile: true,
    tint: "violet",
    depth: 1.25,
  },
];

const TINT_CLASS: Record<NonNullable<IconSpec["tint"]>, string> = {
  blue: "text-sky-300",
  cyan: "text-cyan-300",
  violet: "text-violet-300",
};

/** Deslocamento máximo (px) que o ícone com `depth: 1` pode atingir */
const MAX_SHIFT = 26;

export default function LoginBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Estado "suave" que segue o mouse com atraso (lerp)
  const smooth = useRef({ x: 0, y: 0 });
  // Alvo — atualizado pelo mousemove
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const isPointerFine = useRef(false);

  // ============================================================
  // Loop de animação (lerp)
  // ============================================================
  const tick = useCallback(() => {
    const s = smooth.current;
    const t = target.current;

    // Fator de suavização — 0.08 dá um "trailing" agradável,
    // 0.15 é mais responsivo, 0.04 é mais flutuante.
    const EASE = 0.08;

    s.x += (t.x - s.x) * EASE;
    s.y += (t.y - s.y) * EASE;

    // Escreve direto no DOM (sem re-render do React)
    const el = containerRef.current;
    if (el) {
      el.style.setProperty("--mx", s.x.toFixed(4));
      el.style.setProperty("--my", s.y.toFixed(4));
    }

    // Continua o loop enquanto houver diferença perceptível
    const stillMoving =
      Math.abs(t.x - s.x) > 0.001 || Math.abs(t.y - s.y) > 0.001;

    rafId.current = stillMoving ? requestAnimationFrame(tick) : null;
  }, []);

  // ============================================================
  // Handlers
  // ============================================================
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPointerFine.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Normaliza para [-1, 1] relativamente ao centro
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      target.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      };

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  const handleMouseLeave = useCallback(() => {
    // Volta ao centro quando o mouse sai da janela
    target.current = { x: 0, y: 0 };
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  // ============================================================
  // Setup
  // ============================================================
  useEffect(() => {
    // Só ativa em dispositivos com ponteiro fino (desktop).
    // Em touch, o parallax seria inútil e só gastaria bateria.
    const mq = window.matchMedia("(pointer: fine)");
    isPointerFine.current = mq.matches;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!mq.matches || prefersReduced) return;

    const onMqChange = (e: MediaQueryListEvent) => {
      isPointerFine.current = e.matches;
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [handleMouseMove, handleMouseLeave]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={
        {
          // Valores iniciais — o JS sobrescreve a cada frame enquanto
          // o mouse se move, e o CSS usa `var(--mx) * depth` no transform.
          "--mx": "0",
          "--my": "0",
        } as CSSProperties
      }
    >
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />

      {/* Glow radial central */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18)_0%,transparent_60%)]" />

      {/* Glows de canto */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.22)_0%,transparent_70%)] blur-2xl" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.18)_0%,transparent_70%)] blur-2xl" />

      {/* Grid sutil */}
      <div
        className="login-grid absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.8) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          animation: "login-grid-drift 60s linear infinite",
        }}
      />

      {/* Ícones flutuantes */}
      {ICONS.map((spec, i) => {
        const {
          Icon,
          x,
          y,
          size,
          rotate,
          duration,
          delay,
          variant,
          hideOnMobile,
          tint = "blue",
          depth,
        } = spec;

        const preferredVw = (size / 16).toFixed(2);
        const minPx = Math.round(size * 0.5);
        const dimension = `clamp(${minPx}px, ${preferredVw}vw, ${size}px)`;
        const glowDuration = duration * 0.75;

        // Deslocamento máximo por ícone, escalado por `depth`
        const shift = MAX_SHIFT * depth;

        return (
          <div
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${
              hideOnMobile ? "hidden sm:block" : ""
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {/* Camada 1 — parallax (segue o mouse).
                Usa CSS variables do container, atualizadas via JS no rAF. */}
            <div
              style={{
                transform: `translate3d(calc(var(--mx) * ${shift}px), calc(var(--my) * ${shift}px), 0)`,
                transition: "transform 80ms linear",
                willChange: "transform",
              }}
            >
              {/* Camada 2 — float (sobe/desce/gira) */}
              <div
                className="login-anim"
                style={
                  {
                    width: dimension,
                    height: dimension,
                    "--rot": `${rotate}deg`,
                    animation: `login-float-${variant} ${duration}s ease-in-out ${delay}s infinite`,
                    willChange: "transform",
                  } as CSSProperties
                }
              >
                {/* Camada 3 — glow pulse + cor */}
                <div
                  className={`login-glow ${TINT_CLASS[tint]} w-full h-full`}
                  style={
                    {
                      animation: `login-glow-pulse ${glowDuration}s ease-in-out ${delay + 0.5}s infinite`,
                      willChange: "opacity, filter",
                    } as CSSProperties
                  }
                >
                  <Icon strokeWidth={1.25} className="w-full h-full" />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Vinhetas externas */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/40 to-transparent" />
    </div>
  );
}
