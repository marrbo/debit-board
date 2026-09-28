"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader/Header";
import HeaderActions from "@/components/PageHeader/HeaderActions";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import ScanProfileModal from "@/components/ScanProfileModal";
import Loading from "@/components/Loading";

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

  if (status === "loading") return <Loading />;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4 p-8">
      <PageHeader
        search={undefined}
        actions={
          <div className="flex items-center gap-1">
            <HeaderActions
              onClick={() => setModalOpen(true)}
              disabled={scanning}
              tooltip={scanning ? "Executando..." : "Executar Scanner"}
              color="success"
              badge={
                scanning ? (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                ) : null
              }
            >
              <Play />
            </HeaderActions>

            <HeaderActions
              onClick={() => setRefreshKey((prev) => prev + 1)}
              tooltip="Atualizar"
              color="info"
            >
              <RefreshCw />
            </HeaderActions>
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
