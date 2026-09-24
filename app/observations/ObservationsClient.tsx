"use client";

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Binoculars, ExternalLink, UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import ObservationDrawer from "@/components/ObservationDrawer";
import AssigneeSelect from "@/components/AssigneeSelect";
import BulkAssignAssigneeModal from "@/components/BulkAssignAssigneeModal";
import TeamSelector from "@/components/TeamSelector";
import { useTeam } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";
import { useUsers } from "@/hooks/useUsers";
import type { IObservation } from "@/types/IObservation";
import type { IAzureSettings } from "@/types/IAzureSettings";
import LoadingSkeleton from "@/components/LoadingSkeleton";

// ============================================================
// Helpers de cor (fora do componente)
// ============================================================
const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    open: "bg-red-50 text-red-700 border-red-200",
    recurring: "bg-orange-50 text-orange-700 border-orange-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    wont_fix: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return colors[status] || "bg-gray-100";
};

const severityColor = (severity: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-blue-100 text-blue-800",
  };
  return colors[severity] || "bg-gray-100";
};

// ============================================================
// Componente
// ============================================================
export default function ObservationsClient({
  azureSettings,
}: {
  azureSettings: IAzureSettings | null;
}) {
  const { data: session } = useSession();

  const [selectedObservation, setSelectedObservation] =
    useState<IObservation | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkAssignIds, setBulkAssignIds] = useState<string[] | null>(null);

  // Time persistido
  const [teamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  // Usuários (cache em memória via hook)
  const { users } = useUsers();

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  const handleUpdateAssignee = useCallback(
    async (id: string, value: string | null) => {
      try {
        const res = await fetch("/api/observations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueId: id, assignedTo: value }),
        });
        if (res.ok) {
          setRefreshKey((prev) => prev + 1);
          setSelectedObservation((prev) => {
            if (!prev || prev._id.toString() !== id) return prev;
            return { ...prev, assignedTo: value || undefined } as IObservation;
          });
        } else {
          alert("Erro ao atualizar responsável");
        }
      } catch {
        alert("Erro de rede ao atualizar responsável");
      }
    },
    [],
  );

  const handleSearch = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleBulkAssignSuccess = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    setBulkAssignIds(null);
  }, []);

  // Colunas
  const columns: Column<IObservation>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        width: "90px",
        sortable: true,
        render: (item) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${statusColor(
              item.status,
            )}`}
          >
            {item.status}
          </span>
        ),
      },
      {
        key: "fileName",
        width: "380px",
        label: "Arquivo / Observação",
        sortable: true,
        render: (item) => (
          <div className="flex items-start gap-2">
            <div className="flex flex-col flex-1 min-w-0">
              <span
                className="text-xs font-semibold truncate text-brand cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObservation(item);
                }}
              >
                {item.fileName}
              </span>
              <span className="text-[9px] font-mono text-gray-400 truncate">
                {item.filePath}
              </span>
            </div>
            <Link
              href={`/observations/${item._id}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 p-1 text-muted hover:text-brand transition-colors"
              title="Ver página completa"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        ),
      },
      {
        key: "category",
        width: "150px",
        label: "Categoria",
        sortable: true,
        className: "font-mono text-[10px]",
      },
      {
        key: "patternName",
        width: "220px",
        label: "Sub Categoria",
        sortable: true,
        className: "font-mono text-[10px]",
      },
      {
        key: "branch",
        width: "110px",
        label: "Branch",
        sortable: true,
        render: (item) => (
          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {item.branch}
          </span>
        ),
      },
      {
        key: "severity",
        width: "130px",
        label: "Severidade",
        align: "center",
        sortable: true,
        render: (item) => (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${severityColor(
              item.severity,
            )}`}
          >
            {item.severity}
          </span>
        ),
      },
      {
        key: "assignedTo",
        width: "140px",
        label: "Responsável",
        sortable: true,
        align: "center",
        render: (item) => (
          <div
            className="flex itens-center relative w-fit"
            onClick={(e) => e.stopPropagation()}
          >
            <AssigneeSelect
              users={users}
              value={item.assignedTo}
              onChange={(val) => handleUpdateAssignee(item._id.toString(), val)}
            />
          </div>
        ),
      },
    ],
    [users, handleUpdateAssignee],
  );

  // 🔥 Ações em massa — aparecem na barra do DataTable quando há seleção
  const bulkActions = useMemo(
    () => [
      {
        label: "Atribuir a",
        icon: <UserPlus className="w-4 h-4" />,
        onClick: (ids: string[]) => setBulkAssignIds(ids),
        requiresSelection: true,
      },
    ],
    [],
  );

  return (
    <div className="w-full p-8 space-y-6">
      <PageHeader
        title="Observations Feed"
        subtitle="Central de monitoramento de vulnerabilidades."
        icon={<Binoculars className="w-10 h-10 text-brand" />}
        search={{
          type: "advanced",
          onSearch: handleSearch,
          userSub: session?.user?.sub?.toString() || session?.user?.sub,
          placeholder:
            "Buscar Observations, e.g. severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={<TeamSelector teams={teams} />}
      />

      {!teamsLoaded ? (
        // <div className="py-12 text-center text-muted">Carregando feed...</div>
        <LoadingSkeleton></LoadingSkeleton>
      ) : (
        <DataTable
          endpoint="/api/observations"
          columns={columns}
          searchQuery={searchQuery}
          refreshKey={refreshKey}
          teamId={effectiveTeamId}
          exportOrientation="landscape"
          selectable
          actions={bulkActions}
        />
      )}

      {bulkAssignIds && bulkAssignIds.length > 0 && (
        <BulkAssignAssigneeModal
          observationIds={bulkAssignIds}
          users={users}
          onClose={() => setBulkAssignIds(null)}
          onSuccess={handleBulkAssignSuccess}
        />
      )}

      <ObservationDrawer
        observation={selectedObservation}
        users={users}
        azureSettings={azureSettings}
        onClose={() => setSelectedObservation(null)}
        onUpdateAssignee={handleUpdateAssignee}
      />
    </div>
  );
}
