// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import * as Sentry from "@sentry/nextjs";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- INJEÇÃO DE INSTRUÇÕES (SENTRY E BASEURL) ---
  const host = request.headers.get('host') || 'localhost:3000';
  // const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const protocol = 'https';
  const baseUrl = `${protocol}://${host}`;
  
  // Registra a métrica no Sentry para todas as requisições que passam pelo middleware
  Sentry.metrics.count(pathname, 1);

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const isAdmin = token?.email === process.env.ADMIN_EMAIL;
  const tenantId = token?.tenantId;
  const userId = token?.sub || '';

  // Injeta a baseUrl nos cabeçalhos para que as páginas e APIs consumam
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-base-url', baseUrl);
  requestHeaders.set('x-sentry-trace', request.headers.get('x-sentry-trace') || '');
  requestHeaders.set('x-tenant-id', tenantId || '');
  requestHeaders.set('x-user-id', userId);

  // ------------------------------------------------

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    // Retorna a resposta permitindo os novos cabeçalhos criados
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (!isLoggedIn) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl, { status: 302});
  }

  // FLUXO DO ADMIN
  if (isAdmin) {
    if (pathname === '/stats') {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (pathname.startsWith('/settings/profile/user')) {
      return NextResponse.redirect(new URL('/settings/admin', request.url));
    }
    
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // FLUXO DO USUÁRIO COMUM
  const isOnboardingCompleted = token?.onboardingCompleted === true;
  const isOnSetupPage = pathname.startsWith("/settings/profile/user");

  if (!isOnboardingCompleted) {
    if (!isOnSetupPage) return NextResponse.redirect(new URL('/settings/profile/user', request.url));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isOnboardingCompleted && isOnSetupPage) {
    return NextResponse.redirect(new URL('/stats', request.url));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
