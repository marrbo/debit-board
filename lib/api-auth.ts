// lib/api-auth.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { Session } from "next-auth";
import { rolesFromSession, hasAnyRole, type Role } from "@/lib/permissions";

type SessionUser = Session["user"];

export type AuthResult =
  | { ok: true; user: SessionUser; roles: Role[] }
  | { ok: false; response: NextResponse };

/**
 * Garante sessão válida + tenant.
 * Devolve 401 (sem sessão) ou 423 (sem tenant).
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

  return {
    ok: true,
    user: session.user,
    roles: rolesFromSession(session),
  };
}

/**
 * Sessão + admin. Devolve 401 / 403.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireSession();
  if (auth.ok === false) return auth;

  if (auth.roles.includes("admin") && auth.user.isActive) {
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

/**
 * Sessão + pelo menos um dos papéis exigidos.
 *
 * Uso:
 *   const auth = await requireRole(["admin", "analyst"]);
 *   if (auth.ok === false) return auth.response;
 *
 * `roles` vazio → equivale a `requireSession()`.
 */
export async function requireRole(required: Role[]): Promise<AuthResult> {
  const auth = await requireSession();
  if (auth.ok === false) return auth;

  if (required.length === 0 || hasAnyRole(auth.roles, required)) {
    return auth;
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Forbidden",
        code: "INSUFFICIENT_ROLE",
        required,
      },
      { status: 403 },
    ),
  };
}
