'use client';

import { Suspense, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield } from 'lucide-react';

// Componente interno que usa useSearchParams (precisa do Suspense)
function LoginErrorHandler() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (error === 'inactive') {
    return (
      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
        Acesso negado. Seu Tenant está inativo.
      </div>
    );
  }
  return null;
}

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSSOLogin = () => {
    signIn('keycloak', { callbackUrl: '/stats' });
  };

  return (
    <div className="relative min-h-screen -p-6 -m-6 -t-6 flex items-center justify-center overflow-hidden bg-slate-900">
      <div className="absolute inset-0 z-0">
        <img src="/login-bg.png" alt="Background" className="w-full h-full object-cover opacity-50" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div className="absolute inset-0 bg-slate-900/60"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 bg-white dark:bg-slate-800/80 backdrop-blur-lg border border-gray-200 dark:border-slate-700/50 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">DebitBoard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Segurança & Observabilidade</p>
        </div>

        {/* O envoltório do Suspense vai aqui */}
        <Suspense fallback={null}>
          <LoginErrorHandler />
        </Suspense>

        <button
          onClick={handleSSOLogin}
          className="w-full bg-blue-600 hover:bg-blue-500 text-apple-bg-light dark:text-apple-bg-light font-medium py-2.5 rounded-lg transition-all shadow-md shadow-blue-900/40 flex justify-center items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Entrar com SSO Corporativo
        </button>

        <p className="text-[10px] text-slate-500 text-center mt-4">
          Autenticação gerenciada via Keycloak.
        </p>
      </div>
    </div>
  );
}