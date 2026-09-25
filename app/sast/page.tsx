"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw, ShieldKeyhole } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import ScanProfileModal from "@/components/ScanProfileModal";

interface SASTScanRow {
  _id: string;
  scanDate: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
}

const columns: Column<SASTScanRow>[] = [
  {
    key: "scanDate",
    label: "Data",
    align: "center",
    sortable: true,
    render: (item) =>
      item.scanDate ? new Date(item.scanDate).toLocaleString("pt-BR") : "—",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    align: "center",
    minWidth: "200px",
    headerClassName: "text-center align-center!",
    render: (item) => {
      const config = {
        completed: { label: "Concluído", className: "text-emerald-400" },
        running: {
          label: "Executando",
          className: "text-blue-400 animate-pulse",
        },
        failed: { label: "Falha", className: "text-red-400" },
        pending: { label: "Pendente", className: "text-amber-400" },
        cancelled: { label: "Cancelado", className: "text-gray-400" },
      }[item.status] || { label: item.status, className: "text-gray-400" };

      return (
        <span className={`font-medium ${config.className}`}>
          {config.label}
        </span>
      );
    },
  },
  {
    key: "totalOccurrences",
    label: "Ocorrências",
    sortable: true,
    align: "center",
    minWidth: "200px",
    headerClassName: "text-center align-center",
    render: (item) => item.totalOccurrences || 0,
  },
  {
    key: "patternCount",
    label: "Padrões",
    sortable: true,
    align: "center",
    minWidth: "200px",
    headerClassName: "text-center align-center",
    render: (item) => item.patternCount || 0,
  },
  {
    key: "failedPatterns",
    label: "Falhas",
    sortable: true,
    align: "center",
    minWidth: "200px",
    headerClassName: "text-center align-center text-center",
    render: (item) => item.failedPatterns || 0,
  },
];

function SASTScansContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const runScan = useCallback(
    async (profileId: string | null) => {
      if (scanning) return;
      setScanning(true);
      setError(null);

      try {
        setRefreshKey((prev) => prev + 1);
        const res = await fetch("/api/sast/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });

        if (!res.ok) {
          let errMsg = "Erro ao executar scanner";
          try {
            const data = await res.json();
            errMsg = data.error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }

        setModalOpen(false);
        setRefreshKey((prev) => prev + 1);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError("Erro desconhecido");
      } finally {
        setScanning(false);
      }
    },
    [scanning],
  );

  useEffect(() => {
    if (!scanning) return;

    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [scanning]);

  if (status === "loading")
    return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4 p-8">
      <PageHeader
        title="SAST Scanner"
        icon={<ShieldKeyhole className="w-10 h-10 text-brand" />}
        subtitle="Executa o scanner e acompanhe o histórico de execuções."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              disabled={scanning}
              className="flex items-center gap-2 bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Executar Scanner
                </>
              )}
            </button>
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <DataTable
        key={refreshKey}
        endpoint="/api/sast/scans"
        columns={columns}
        defaultSort={{ field: "scanDate", order: "desc" }}
        defaultLimit={10}
        selectable={false}
        onRowClick={() => {}}
      />

      <ScanProfileModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onRun={runScan}
        running={scanning}
      />
    </div>
  );
}

export default function SASTScansPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center">
          Carregando histórico de scans...
        </div>
      }
    >
      <SASTScansContent />
    </Suspense>
  );
}
