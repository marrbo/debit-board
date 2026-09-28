// components/login/LoginMarketing.tsx
"use client";

import { ShieldCheck, Activity, Sparkles, Building2 } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "SAST unificado",
    body: "Achados consolidados de múltiplos scanners em um modelo único.",
  },
  {
    icon: Activity,
    title: "Monitoramento contínuo",
    body: "SLA, severidade e status atualizados a cada varredura.",
  },
  {
    icon: Sparkles,
    title: "Assistente IA",
    body: "Pergunte em linguagem natural sobre qualquer achado ou regra.",
  },
  {
    icon: Building2,
    title: "Multi-tenant",
    body: "Isolamento completo por tenant, SSO via Keycloak.",
  },
] as const;

/**
 * Painel de marketing do login.
 *
 * Renderiza sobre o `LoginBackground` (que provê o fundo escuro e as
 * animações). Usa cores hardcoded claras porque o painel sempre fica
 * sobre o fundo escuro, independente do tema da aplicação.
 */
export default function LoginMarketing() {
  return (
    <div className="relative z-10 max-w-4xl space-y-10">
      {/* Identidade */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <span className="text-lg font-bold font-mono text-white">db</span>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/60">
              Debit-Board
            </p>
            <p className="text-[11px] text-white/40">
              Application Security Posture Management
            </p>
          </div>
        </div>

        <h1 className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight text-white">
          Segurança em
          <br />
          <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-blue-400 bg-clip-text text-transparent">
            um só lugar.
          </span>
        </h1>

        <p className="text-base xl:text-lg text-white/70 max-w-lg leading-relaxed">
          A plataforma interna que unifica SAST e SCA, prioriza achados e
          acelera a resposta do time de segurança.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="p-4 rounded-lg bg-white/[0.04] backdrop-blur-sm hover:bg-white/[0.07] transition-colors"
          >
            <Icon className="w-5 h-5 text-sky-300 mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
            <p className="text-xs text-white/60 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Rodapé institucional */}
      <div className="pt-4 border-t border-white/10 flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider text-white/40">
        <span>v2026.9</span>
        <span aria-hidden="true">·</span>
        <span>Keycloak SSO</span>
        <span aria-hidden="true">·</span>
        <span>Internal use only</span>
      </div>
    </div>
  );
}
