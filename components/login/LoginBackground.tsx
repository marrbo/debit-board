// components/login/LoginBackground.tsx
//
// Fundo do painel de marketing do login.
//
// Visualmente idêntico ao painel do Keycloak (template.ftl).

export default function LoginBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Base — gradiente escuro azulado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1020] via-[#0f172a] to-[#0a1020]" />

      {/* Glow central */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(37,99,235,0.14)_0%,transparent_65%)]" />

      {/* Glows de canto */}
      <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16)_0%,transparent_70%)]" />
      <div className="absolute -bottom-40 -right-40 w-[640px] h-[640px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.12)_0%,transparent_70%)]" />

      {/* Grid estático */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.8) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Vinhetas topo/base */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
