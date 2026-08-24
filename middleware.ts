// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const isAdmin = token?.email === process.env.ADMIN_EMAIL;

  if (!isLoggedIn) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // FLUXO DO ADMIN
  if (isAdmin) {
    // Admin pode ver o Dashboard!
    if (pathname === '/stats') return NextResponse.next();

    // Admin bloqueado do Setup, vai para o Admin
    if (pathname.startsWith('/settings/profile/user')) {
      return NextResponse.redirect(new URL('/settings/admin', request.url));
    }
    return NextResponse.next();
  }

  // FLUXO DO USUÁRIO COMUM
  const isOnboardingCompleted = token?.onboardingCompleted === true;
  const isOnSetupPage = pathname.startsWith("/settings/profile/user");

  if (!isOnboardingCompleted) {
    if (!isOnSetupPage) return NextResponse.redirect(new URL('/settings/profile/user', request.url));
    return NextResponse.next();
  }

  if (isOnboardingCompleted && isOnSetupPage) {
    return NextResponse.redirect(new URL('/stats', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};