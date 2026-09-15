"use client";

import {
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { exportDashboardPDF } from "@/utils/exportDashboardPDF";
import PageHeader from "@/components/PageHeader";
import { ChartAreaIcon } from "lucide-react";
import { FaFilePdf } from "react-icons/fa";
import TeamStatsCard from "@/components/TeamStatsCard";
import TeamSelector from "@/components/TeamSelector";
import { DataTable, type Column } from "@/components/DataTable";
import { useTeam } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";

// ============================================================
// Colunas do grid
// ============================================================
const columns: Column<any>[] = [
  { key: "name", width: "250px", label: "Projeto", sortable: true },
  {
    key: "observationSeverityCounts",
    label: "Severidade",
    sortable: false,
    width: "260px",
    className: "hover:scale-150 hover:translate-x-6",
    render: (item: any, extraData?: Record<string, any>) => {
      const stats = extraData?.[item.name] || {};
      const sev = stats.severity || {};

      const severityItems = [
        { letter: "C", count: sev.critical || 0, color: "#ef4444", label: "Critical" },
        { letter: "H", count: sev.high || 0, color: "#f97316", label: "High" },
        { letter: "M", count: sev.medium || 0, color: "#eab308", label: "Medium" },
        { letter: "L", count: sev.low || 0, color: "#22c55e", label: "Low" },
      ];

      return (
        <div className="flex items-center gap-2">
          {severityItems.map((sevItem) => (
            <div
              key={sevItem.letter}
              className="flex flex-col items-center gap-0.5"
              title={`${sevItem.label}: ${sevItem.count}`}
            >
              <div className="relative w-7 h-8">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
                    fill={sevItem.color}
                  />
                  <path
                    d="M12 2L4 5v6c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V5l-8-3z"
                    fill="none"
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="0.8"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[11px]">
                  {sevItem.letter}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                {sevItem.count}
              </span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    key: "description",
    label: "Descrição",
    sortable: true,
    exportable: false,
    className:
      "text-ellipsis text-muted italic font-mono text-xs line-clamp-1 text-wrap",
  },
  {
    key: "lastScan",
    label: "Last scan",
    sortable: true,
    width: "120px",
    align: "center",
    render: (item: any) => {
      if (!item.syncDate) return "—";
      const diff = Date.now() - new Date(item.syncDate).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return "há menos de 1h";
      if (hours < 24) return `há ${hours}h`;
      return `há ${Math.floor(hours / 24)}d`;
    },
  },
];

// ============================================================
// Conteúdo
// ============================================================
function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 🔥 Time persistido no localStorage (fonte única com Stats, etc.)
  const [teamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");

  const [stats, setStats] = useState<any>({
    teamStats: {
      total: 0,
      severityTotals: {},
      statusTotals: {},
      categoryTotals: {},
    },
    projectStats: {},
  });

  const [projects, setProjects] = useState<any[]>([]);

  // Time efetivo (global → 'all')
  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  // teamName derivado
  const teamName = useMemo(
    () => teams.find((t) => t._id === teamId)?.name ?? "",
    [teams, teamId],
  );

  // ============================================================
  // Stats
  // ============================================================
  useEffect(() => {
    if (!teamsLoaded || !effectiveTeamId) return;
    const params = new URLSearchParams({ teamId: effectiveTeamId, range: "30d" });
    if (searchTerm) params.set("q", searchTerm);

    fetch(`/api/dashboard/stats?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const fallback = {
          teamStats: {
            total: 0,
            severityTotals: {},
            statusTotals: {},
            categoryTotals: {},
          },
          projectStats: {},
        };
        if (!text) {
          setStats(fallback);
          return;
        }
        try {
          setStats(JSON.parse(text));
        } catch (e) {
          console.error("Erro ao parsear JSON de stats:", e);
          setStats(fallback);
        }
      })
      .catch((err) => {
        console.error("Erro ao buscar stats:", err);
        setStats({
          teamStats: {
            total: 0,
            severityTotals: {},
            statusTotals: {},
            categoryTotals: {},
          },
          projectStats: {},
        });
      });
  }, [teamsLoaded, effectiveTeamId, searchTerm]);

  // ============================================================
  // Lista de projetos (para export e título)
  // ============================================================
  useEffect(() => {
    if (!teamsLoaded || !effectiveTeamId) return;
    const params = new URLSearchParams({
      teamId: effectiveTeamId,
      page: "1",
      limit: "100",
      sort: "name",
      order: "asc",
    });
    if (searchTerm) params.set("q", searchTerm);

    fetch(`/api/dashboard?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!text) {
          setProjects([]);
          return;
        }
        try {
          const json = JSON.parse(text);
          setProjects(json.data || []);
        } catch (e) {
          console.error("Erro ao parsear JSON de projetos:", e);
          setProjects([]);
        }
      })
      .catch((err) => {
        console.error("Erro ao buscar projetos:", err);
        setProjects([]);
      });
  }, [teamsLoaded, effectiveTeamId, searchTerm]);

  const handleSearch = useCallback((newQuery: string) => {
    setSearchTerm(newQuery);
  }, []);

  const handleExportPDF = useCallback(async () => {
    const params = new URLSearchParams({
      teamId: effectiveTeamId,
      all: "true",
      sort: "name",
      order: "asc",
    });
    if (searchTerm) params.set("q", searchTerm);

    const res = await fetch(`/api/dashboard?${params.toString()}`);
    if (!res.ok) {
      alert("Erro ao buscar dados para exportação");
      return;
    }

    const json = await res.json();
    const allProjects = json.data || [];

    const projectsForPDF = allProjects.map((p: any) => {
      const projectStat = stats.projectStats?.[p.name] || {};
      return {
        name: p.name,
        description: p.description,
        lastScan: p.syncDate
          ? new Date(p.syncDate).toLocaleDateString("pt-BR")
          : "—",
        severity: projectStat.severity || {},
      };
    });

    await exportDashboardPDF({
      teamName,
      generatedAt: new Date(),
      teamStats: stats.teamStats,
      projectStats: stats.projectStats,
      projects: projectsForPDF,
      categoryDetails: stats.categoryDetails,
    });
  }, [effectiveTeamId, searchTerm, stats, teamName]);

  if (status === "loading")
    return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Dashboard"
        icon={<ChartAreaIcon className="w-10 h-10 text-brand" />}
        subtitle="Visão geral do time selecionado."
        search={{
          type: "advanced",
          onSearch: handleSearch,
          userId: session?.user?._id?.toString() || session?.user?.id,
          placeholder: "Filtrar stats, e.g. severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportPDF}
              disabled={projects.length === 0}
              className="flex items-center group gap-2 px-4 py-2 rounded-2xl bg-red-600 text-white text-sm font-medium hover:!bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden group-hover:block transition-transform">Relatório PDF</span>
              <FaFilePdf className="w-4 h-4" />
            </button>

            <TeamSelector teams={teams} />
          </div>
        }
      />

      {!teamsLoaded ? (
        <div className="py-12 text-center text-muted">Carregando times...</div>
      ) : teamId ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TeamStatsCard
              type="status"
              title="Severidade e Status"
              total={stats.teamStats.total}
              severity={stats.teamStats.severityTotals}
              status={stats.teamStats.statusTotals}
            />
            <TeamStatsCard
              type="category"
              title="Distribuição por Categoria"
              total={stats.teamStats.total}
              category={stats.teamStats.categoryTotals}
              categoryGroup={stats.teamStats.categoryGroupTotals}
              categoryDetails={stats.categoryDetails}
            />
          </div>

          <div className="pt-4 border-t border-default dark:border-strong">
            <h3 className="text-lg font-semibold mb-4">
              Projetos - {effectiveTeamId === "all" ? "Global" : teamName}
            </h3>
            <DataTable
              endpoint="/api/dashboard"
              columns={columns}
              defaultSort={{ field: "name", order: "asc" }}
              defaultLimit={10}
              pdfTitle={`Projetos: Severidades - ${
                effectiveTeamId === "all" ? "Global" : teamName
              }`}
              teamId={effectiveTeamId}
              extraData={stats.projectStats}
              onRowClick={() => {}}
            />
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-muted">
          Selecione um time para visualizar o dashboard.
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center">Carregando dashboard...</div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}