// app/error.tsx
'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.log(error);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-8 max-w-lg shadow-sm">
        <h2 className="text-xl font-bold text-red-400 mb-2">Algo deu errado!</h2>
        <p className="text-sm text-slate-300 mb-4">
          Ocorreu um erro inesperado ao carregar esta página.
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-500 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}