// lib/api-auth.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { Session } from "next-auth";

type SessionUser = Session["user"];

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Garante que a request tem sessão válida.
 * Devolve 401 com formato padrão para o scanner de BOLA.
 * Devolve 403 se o usuário não estiver associado a um Tenant
 */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "NO_SESSION" },
        { status: 401 },
      ),
    };
  }

  if (!session.user?.tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Locked. Usuário sem Tenant" },
        { status: 423 },
      ),
    };
  }

  return { ok: true, user: session.user };
}

/**
 * Garante que a request tem sessão E é admin.
 * Devolve 401 (sem sessão) ou 403 (sem permissão).
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireSession();
  if (auth.ok === false) return auth;

  if (auth.user.isAdmin && auth.user.isActive) {
    return auth;
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Forbidden", code: "NOT_ADMIN" },
      { status: 403 },
    ),
  };
}
