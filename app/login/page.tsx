"use client";

import { Suspense, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldKeyhole } from "lucide-react";
import LoginBackground from "@/components/LoginBackground";

// Componente interno que usa useSearchParams (precisa do Suspense)
function LoginErrorHandler() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error === "inactive") {
    return (
      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
        Acesso negado. Seu Tenant está inativo.
      </div>
    );
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession(); // 🔥 Agora status está definido

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      router.push("/");
    }
  }, [sessionStatus, router]);

  const handleSSOLogin = () => {
    signIn("keycloak", { callbackUrl: "/" });
  };

  return (
    <div className="relative min-h-screen -p-6 -m-6 -t-6 flex items-center justify-center overflow-hidden bg-slate-900">
      <LoginBackground />

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-slate-900/60"></div>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 p-10 bg-page dark:bg-surface/80 backdrop-blur-lg border rounded-lg shadow-sm">
        <div className="flex flex-col justify-stretch text-justify items-center mb-6">
          <h1 className="text-4xl font-bold text-bold dark:text-white tracking-tight font-mono">
            [db] Debit-Board
          </h1>
          <p className="text-xs text-muted font-mono justify-stretch">
            Segurança em um só lugar!
          </p>
        </div>

        {/* O envoltório do Suspense vai aqui */}
        <Suspense fallback={null}>
          <LoginErrorHandler />
        </Suspense>

        <button
          onClick={handleSSOLogin}
          className="w-full bg-brand hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition-all shadow-md flex justify-center items-center gap-2"
        >
          <ShieldKeyhole className="w-4 h-4" />
          Entrar com SSO Corporativo
        </button>

        <p className="text-[10px] text-slate-500 text-center mt-4">
          Autenticação gerenciada via Keycloak.
        </p>
      </div>
    </div>
  );
}
