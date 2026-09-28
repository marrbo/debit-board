// lib/theme-cookie.ts
//
// Sincroniza o tema do app (Next.js) com o Keycloak.
//
// O Keycloak não tem API de "theme hint". A forma suportada é um
// cookie no domínio pai, lido pelo `template.ftl` antes do CSS pintar
// (evita flash de tema errado).
//
// Regras de domínio:
//   - localhost / 127.0.0.1  → cookie host-only (vale para :3000 e :8080)
//   - app.foo.com            → Domain=.foo.com (vale para auth.foo.com)
//   - domínios diferentes    → cookie não passa; usar query param

export const THEME_COOKIE = "db_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export type ResolvedTheme = "light" | "dark";

function cookieDomain(hostname: string): string {
  if (hostname === "localhost" || hostname === "127.0.0.1") return "";
  const parts = hostname.split(".");
  if (parts.length < 2) return "";
  return `; Domain=.${parts.slice(-2).join(".")}`;
}

/**
 * Grava o tema **resolvido** no cookie.
 * Idempotente: pode ser chamado em qualquer render sem efeito colateral.
 * No-op em SSR (document indefinido).
 */
export function writeThemeCookie(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${THEME_COOKIE}=${theme}` +
    `; Path=/` +
    `; Max-Age=${THEME_COOKIE_MAX_AGE}` +
    `; SameSite=Lax` +
    cookieDomain(window.location.hostname);
}

/**
 * Lê o tema do cookie. Retorna null se ausente ou inválido.
 * Útil para debug / reconciliação — o Keycloak lê por conta própria
 * via script inline no `template.ftl`.
 */
export function readThemeCookie(): ResolvedTheme | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`),
  );
  if (!m) return null;
  const v = decodeURIComponent(m[1]);
  return v === "light" || v === "dark" ? v : null;
}
