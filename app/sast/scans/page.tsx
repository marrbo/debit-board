// app/sast/scans/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle, XCircle, Clock, Play } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

type SastScanStatus = 'completed' | 'running' | 'failed' | 'pending';

type SastScan = {
  _id?: string;
  createdAt?: string;
  status?: SastScanStatus;
  totalOccurrences?: number;
};

export default function SASTScansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scans, setScans] = useState<SastScan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = async () => {
    setLoading(true);
    const res = await fetch('/api/sast/scans');
    if (res.ok) setScans(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'authenticated') return;

    void (async () => {
      setLoading(true);
      const res = await fetch('/api/sast/scans');
      if (res.ok) setScans(await res.json());
      setLoading(false);
    })();
  }, [status]);

  if (status === 'loading') return <div className="py-10 text-gray-500 dark:text-slate-400">Carregando...</div>;
  if (!session) { router.push('/login'); return null; }

  return (
    <div className="w-full space-y-6">
      
      {/* Cabeçalho Unificado */}
      <PageHeader
        title="Histórico de Scans SAST"
        subtitle="Acompanhe o status e os resultados das execuções do SAST Scanner."
        actions={
          <button onClick={() => fetchScans()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white px-3 py-1.5 rounded text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        }
      />

      {loading ? (
        <div className="text-center py-10 text-gray-500 dark:text-slate-400">Carregando histórico...</div>
      ) : scans.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center text-gray-500 dark:text-slate-400">
          Nenhuma varredura SAST iniciada ainda.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden w-full">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900 text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ocorrências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {scans.map((s) => (
                <tr key={s._id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 font-mono text-slate-300 text-xs">
                    {/* {format(new Date(s?.createdAt) || Date.now, 'dd/MM/yyyy HH:mm', { locale: ptBR })} */}
                    { s?.createdAt }
                  </td>
                  <td className="p-4 flex items-center gap-2">
                    {s.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {s.status === 'running' && <Play className="w-4 h-4 text-blue-400 animate-pulse" />}
                    {s.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    {s.status === 'pending' && <Clock className="w-4 h-4 text-amber-400" />}
                    <span className={`text-xs font-medium ${
                      s.status === 'completed' ? 'text-emerald-400' :
                      s.status === 'running' ? 'text-blue-400' :
                      s.status === 'failed' ? 'text-red-400' :
                      'text-amber-400'
                    }`}>
                      {s.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-gray-900 dark:text-white">{s.totalOccurrences || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}