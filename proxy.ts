import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import * as Sentry from "@sentry/nextjs";
import { getNextAuthUrl } from "./lib/utils";

// ---------------------------------------------------------------------------
// Rotas públicas — sempre acessíveis, sem sessão
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/cron",
  "/api/webhooks",
  "/api/openapi.json",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function matchesPrefix(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Injeta cabeçalhos de segurança, remediação de RateLimit e remove cabeçalhos que vazam topologia de rede
 */
function applySecurityHeaders(
  response: NextResponse,
  pathname?: string,
): NextResponse {
  // 1. Remove o cabeçalho de vazamento de informações do ngrok reportado anteriormente
  response.headers.delete("ngrok-agent-ips");

  // 2. Aplica a remediação do cabeçalho HTTP Strict-Transport-Security (HSTS)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  // 3. Aplica a remediação de Rate Limit se for uma rota de API (/api/*)
  if (pathname && isApiPath(pathname)) {
    response.headers.set("RateLimit-Limit", "100;w=60");
  }

  return response;
}

function unauthorizedResponse(
  request: NextRequest,
  pathname: string,
  search: string,
): NextResponse {
  if (isApiPath(pathname)) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      pathname,
    );
  }

  const signInUrl = new URL("/login", request.url);
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return applySecurityHeaders(
    NextResponse.redirect(signInUrl, { status: 302 }),
    pathname,
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  Sentry.metrics.count(pathname, 1);

  const host = request.headers.get("host") ?? "localhost:3001";
  const baseUrl = `https://${host}`;

  const NEXTAUTH_URL = getNextAuthUrl();
  const useSecureCookie = (NEXTAUTH_URL ?? "").startsWith("https://");

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: useSecureCookie,
  });

  const isLoggedIn = !!token;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-base-url", baseUrl);
  requestHeaders.set(
    "x-sentry-trace",
    request.headers.get("x-sentry-trace") ?? "",
  );
  if (token?.tenantId) {
    requestHeaders.set("x-tenant-id", String(token.tenantId));
  }
  if (token?.sub) {
    requestHeaders.set("x-user-id", token.sub);
  }

  // --- Rotas públicas ---
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname,
    );
  }

  // --- Sem sessão → 401 (API) ou /login (página) ---
  if (!isLoggedIn) {
    return unauthorizedResponse(request, pathname, search);
  }

  // --- Fluxo do admin ---
  const isAdmin = token?.isAdmin === true;
  if (isAdmin) {
    if (pathname.startsWith("/settings/profile/user")) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/settings/admin", request.url)),
        pathname,
      );
    }
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      pathname,
    );
  }

  // --- Não-admin: bloqueia /settings/admin/* ---
  if (pathname.startsWith("/settings/admin")) {
    if (isApiPath(pathname)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        pathname,
      );
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/settings", request.url)),
      pathname,
    );
  }

  // --- Fluxo do usuário comum (onboarding) ---
  const isOnboardingCompleted = token?.onboardingCompleted === true;
  const isOnSetupPage = pathname.startsWith("/settings/profile/user");

  if (!isOnboardingCompleted && !isOnSetupPage) {
    if (isApiPath(pathname)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Onboarding required" }, { status: 403 }),
        pathname,
      );
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/settings/profile/user", request.url)),
      pathname,
    );
  }

  if (isOnboardingCompleted && isOnSetupPage) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/", request.url)),
      pathname,
    );
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
  );
}

// ---------------------------------------------------------------------------
// Matcher — o middleware não roda em assets estáticos
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/webhooks|api/openapi\\.json|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
