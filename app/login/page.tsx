// app/login/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldKeyhole } from "lucide-react";
import LoginBackground from "@/components/login/LoginBackground";
import LoginMarketing from "@/components/login/LoginMarketing";
import DebitBoardLogo from "@/components/brand/DebitBoardLogo";

function LoginErrorHandler() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error === "inactive") {
    return (
      <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm text-center">
        Acesso negado. Seu Tenant está inativo.
      </div>
    );
  }
  return null;
}

/**
 * Página de login.
 *
 * Layout split (65% / 35% no desktop):
 *  - **Esquerda**: painel de marketing sobre o `LoginBackground`
 *    (que só aparece em `lg+` para poupar CPU em mobile).
 *  - **Direita**: card de login alinhado ao centro.
 *
 * Em mobile, o `LoginBackground` aparece discretamente atrás do
 * card com um overlay para garantir legibilidade.
 */
export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") router.push("/");
  }, [status, router]);

  const handleSSOLogin = () => signIn("keycloak", { callbackUrl: "/" });

  return (
    <div className="relative min-h-screen grid lg:grid-cols-[minmax(0,65%)_minmax(0,35%)] overflow-hidden">
      {/* ==================== Coluna esquerda — marketing ==================== */}
      <div className="relative hidden lg:flex flex-col justify-center px-12 xl:px-20 py-16 overflow-hidden">
        <LoginBackground />
        <LoginMarketing />
      </div>

      {/* ==================== Coluna direita — login ==================== */}
      <div className="relative flex items-center justify-center p-6 bg-page lg:border-l lg:border-default">
        {/* Mobile: background reduzido + overlay para legibilidade */}
        <div className="lg:hidden absolute inset-0" aria-hidden="true">
          <LoginBackground />
          <div className="absolute inset-0 bg-page/85 backdrop-blur-sm" />
        </div>

        <div className="relative z-10 w-full max-w-sm space-y-6">
          {/* Logo + título */}
          <div className="flex flex-col items-center text-center gap-2">
            <DebitBoardLogo size={50} />
            <h1 className="text-[28px] font-bold text-heading font-mono tracking-tight">
              Debit-Board
            </h1>
            <p className="text-xs text-muted -mt-3 font-mono">
              Segurança em um só lugar
            </p>
          </div>

          {/* Card de login */}
          <div className="card dark:border-none p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-heading">
                Bem-vindo de volta
              </h2>
              <p className="text-xs text-muted">
                Entre com sua conta corporativa para continuar.
              </p>
            </div>

            <Suspense fallback={null}>
              <LoginErrorHandler />
            </Suspense>

            <button
              onClick={handleSSOLogin}
              className="w-full btn-primary btn-lg justify-center"
            >
              <ShieldKeyhole className="w-4 h-4" />
              Entrar com SSO
            </button>

            <p className="text-[10px] text-muted text-center">
              Autenticação gerenciada via Keycloak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
