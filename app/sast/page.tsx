//app/sast/page.tsx
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
import SASTScanDrawer, {
  type SASTRerunPayload,
} from "@/components/SASTScanDrawer";
import Loading from "@/components/Loading";
import type { RiskBand } from "@/lib/risk";
import RiskBadge from "@/components/RiskBadge";
import SASTSubnav from "@/components/SASTSubnav";
import {
  formatDuration,
  formatDate,
  ORIGIN_LABEL,
  ORIGIN_STYLE,
} from "@/lib/sast";

interface SASTScanRow {
  _id: string;
  scanId?: string;
  origin:
    | "azure-search-code"
    | "sonarqube"
    | "trivy"
    | "dependency-track"
    | "snyk";
  scanDate: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
  riskScore?: number;
  riskBand?: RiskBand;
  profileId?: string | null;
  profileName?: string | null;
  rerunOfScanId?: string | null;
  durationMs?: number | null;
}

const columns: Column<SASTScanRow>[] = [
  {
    key: "scanId",
    label: "ID",
    sortable: true,
    align: "left",
    minWidth: "180px",
    render: (item) =>
      item.scanId ? (
        <span className="font-mono text-[11px] text-brand" title={item._id}>
          {item.scanId}
        </span>
      ) : (
        <span className="font-mono text-[11px] text-muted italic">
          não migrado
        </span>
      ),
  },
  {
    key: "origin",
    label: "Origem",
    sortable: true,
    align: "left",
    minWidth: "140px",
    render: (item) => (
      <span
        className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border ${
          ORIGIN_STYLE[item.origin] ?? "border-gray-700 text-muted"
        }`}
      >
        {ORIGIN_LABEL[item.origin] ?? item.origin}
      </span>
    ),
  },
  {
    key: "profileName",
    label: "Perfil",
    sortable: false,
    align: "left",
    minWidth: "140px",
    render: (item) => {
      if (item.rerunOfScanId) {
        return (
          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 bg-blue-500/10">
            Re-run
          </span>
        );
      }
      if (item.profileName) {
        return (
          <span
            className="text-xs text-heading truncate"
            title={item.profileName}
          >
            {item.profileName}
          </span>
        );
      }
      return <span className="text-xs text-muted italic">Default</span>;
    },
  },
  {
    key: "scanDate",
    label: "Data",
    align: "left",
    sortable: true,
    minWidth: "160px",
    render: (item) => (item.scanDate ? formatDate(item.scanDate) : "—"),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    align: "center",
    minWidth: "120px",
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
        <span className={`font-medium text-xs ${config.className}`}>
          {config.label}
        </span>
      );
    },
  },
  {
    key: "riskScore",
    label: "Risco",
    sortable: true,
    align: "center",
    minWidth: "110px",
    render: (item) =>
      typeof item.riskScore === "number" ? (
        <RiskBadge score={item.riskScore} />
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "totalOccurrences",
    label: "Ocorrências",
    sortable: true,
    align: "right",
    minWidth: "110px",
    render: (item) => (
      <span className="tabular-nums">{item.totalOccurrences || 0}</span>
    ),
  },
  {
    key: "patternCount",
    label: "Padrões",
    sortable: true,
    align: "right",
    minWidth: "110px",
    render: (item) => (
      <div className="flex flex-col items-end leading-tight">
        <span className="tabular-nums text-heading">
          {item.patternCount || 0}
        </span>
        {(item.failedPatterns ?? 0) > 0 && (
          <span className="text-[10px] text-red-400 tabular-nums">
            {item.failedPatterns}{" "}
            {item.failedPatterns === 1 ? "falha" : "falhas"}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "durationMs",
    label: "Duração",
    sortable: true,
    align: "right",
    minWidth: "100px",
    render: (item) => (
      <span className="tabular-nums text-muted text-xs">
        {formatDuration(item.durationMs)}
      </span>
    ),
  },
];

type RunPayload = SASTRerunPayload | { profileId: string | null };

function SASTScansContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const runScan = useCallback(
    async (payload: RunPayload) => {
      if (scanning) return;
      setScanning(true);
      setError(null);

      try {
        setRefreshKey((prev) => prev + 1);
        const res = await fetch("/api/sast/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        setSelectedScanId(null);
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

  const handleRunFromModal = useCallback(
    (profileId: string | null) => runScan({ profileId }),
    [runScan],
  );

  const handleRerunFromDrawer = useCallback(
    (payload: SASTRerunPayload) => runScan(payload),
    [runScan],
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

      <SASTSubnav />

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
        onRowClick={(scan) => setSelectedScanId(scan._id.toString())}
      />

      <ScanProfileModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onRun={handleRunFromModal}
        running={scanning}
      />

      <SASTScanDrawer
        scanId={selectedScanId}
        onClose={() => setSelectedScanId(null)}
        onRerun={handleRerunFromDrawer}
        rerunning={scanning}
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
