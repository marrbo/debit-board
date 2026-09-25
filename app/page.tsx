// app/page.tsx
"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
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
import { useRangeState } from "@/hooks/useRangeState";
import { writeRangeState } from "@/lib/range-options";
import { drawSeverityShields } from "@/components/DataTable/pdfShared";
import RangeSelector from "@/components/RangeSelector";

// ============================================================
// Colunas do grid
// ============================================================
/**
 * Aplica cor de fundo suave + fonte bold colorida a uma célula
 * de severidade. Quando o valor é 0, deixa neutro para o olho
 * bater nas células com contagem > 0.
 */
function applySeverityCellStyle(
  cell: any,
  value: number,
  palette: { fill: string; font: string },
) {
  cell.value = value;
  cell.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  if (value > 0) {
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: palette.font },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: palette.fill },
    };
  } else {
    // Zero: cinza neutro, sem fill — não compete visualmente
    cell.font = {
      name: "Arial",
      size: 10,
      color: { argb: "FF94A3B8" }, // slate-400
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
  }
}

const columns: Column<any>[] = [
  { key: "name", width: "250px", label: "Projeto", sortable: true },
  {
    key: "observationSeverityCounts",
    label: "Severidade",
    sortable: false,
    width: "260px",
    align: "center",
    className: "hover:scale-150 hover:translate-x-16 translate-x-10",
    /**
     * No PDF: desenha os shields C/H/M/L com as contagens abaixo,
     * lendo os dados do `extraData` (projectStats) — igual à tela.
     */
    pdfCellRenderer: (doc, cell, item, extraData) => {
      const stats = extraData?.[item.name] || {};
      const sev = stats.severity || {};
      drawSeverityShields(
        doc,
        cell.cell.x,
        cell.cell.y,
        sev,
        cell.cell.width,
        cell.cell.height,
      );
    },
    // 🔑 Excel: 4 colunas separadas (Crítico, Alto, Médio, Baixo)
    excelSubColumns: [
      {
        label: "Crítico",
        width: 80,
        render: (item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          return sev.critical || 0;
        },
        excelCellRenderer: (cell, item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          const value = sev.critical || 0;
          applySeverityCellStyle(cell, value, {
            fill: "FFFEE2E2", // red-100
            font: "FF991B1B", // red-800
          });
        },
      },
      {
        label: "Alto",
        width: 80,
        render: (item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          return sev.high || 0;
        },
        excelCellRenderer: (cell, item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          const value = sev.high || 0;
          applySeverityCellStyle(cell, value, {
            fill: "FFFED7AA", // orange-200
            font: "FF9A3412", // orange-800
          });
        },
      },
      {
        label: "Médio",
        width: 80,
        render: (item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          return sev.medium || 0;
        },
        excelCellRenderer: (cell, item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          const value = sev.medium || 0;
          applySeverityCellStyle(cell, value, {
            fill: "FFFEF3C7", // amber-100
            font: "FF92400E", // amber-800
          });
        },
      },
      {
        label: "Baixo",
        width: 80,
        render: (item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          return sev.low || 0;
        },
        excelCellRenderer: (cell, item, extraData) => {
          const sev = extraData?.[item.name]?.severity || {};
          const value = sev.low || 0;
          applySeverityCellStyle(cell, value, {
            fill: "FFDCFCE7", // green-100
            font: "FF166534", // green-800
          });
        },
      },
    ],
    render: (item: any, extraData?: Record<string, any>) => {
      const stats = extraData?.[item.name] || {};
      const sev = stats.severity || {};
      const severityItems = [
        {
          letter: "C",
          count: sev.critical || 0,
          color: "#ef4444",
          label: "Critical",
        },
        { letter: "H", count: sev.high || 0, color: "#f97316", label: "High" },
        {
          letter: "M",
          count: sev.medium || 0,
          color: "#eab308",
          label: "Medium",
        },
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

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  const [searchDbqlId, setSearchDbqlId] = useState(searchParams.get("q") || "");
  const [searchVersion, setSearchVersion] = useState(0);

  // 🔥 Hook estável — `state` só muda de referência quando um campo muda
  const { state: rangeState, rangeKey } = useRangeState();

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

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  const teamName = useMemo(
    () => teams.find((t) => t._id === teamId)?.name ?? "",
    [teams, teamId],
  );

  // ============================================================
  // Stats — usa `rangeKey` (string estável) em vez do objeto
  // ============================================================
  useEffect(() => {
    if (!teamsLoaded || !effectiveTeamId) return;
    const params = new URLSearchParams({ teamId: effectiveTeamId });
    writeRangeState(rangeState, params);
    if (searchDbqlId) params.set("q", searchDbqlId);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsLoaded, effectiveTeamId, searchDbqlId, rangeKey, searchVersion]);

  // ============================================================
  // Lista de projetos
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
    writeRangeState(rangeState, params);
    if (searchDbqlId) params.set("q", searchDbqlId);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsLoaded, effectiveTeamId, searchDbqlId, rangeKey, searchVersion]);

  const handleSearch = useCallback((newQuery: string) => {
    setSearchDbqlId(newQuery);
    setSearchVersion((v) => v + 1);
  }, []);

  const handleExportPDF = useCallback(async () => {
    const params = new URLSearchParams({
      teamId: effectiveTeamId,
      all: "true",
      sort: "name",
      order: "asc",
    });
    writeRangeState(rangeState, params);
    if (searchDbqlId) params.set("q", searchDbqlId);

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
  }, [effectiveTeamId, searchDbqlId, rangeState, stats, teamName]);

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
          userSub: session?.user?.sub,
          placeholder:
            "Filtrar stats, e.g. severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={
          <div className="flex items-center gap-4">
            <RangeSelector />
            <button
              onClick={handleExportPDF}
              disabled={projects.length === 0}
              className="group btn-ghost !text-red-500 hover:!bg-red-600"
            >
              <span className="hidden group-hover:block transition-transform mr-2">
                Resumo Executivo{" "}
              </span>
              <FaFilePdf className="w-5 h-5" />
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
              searchDbqlId={searchDbqlId}
              refreshKey={searchVersion}
              range={
                rangeState.mode === "preset" && rangeState.preset !== "all"
                  ? rangeState.preset
                  : undefined
              }
              rangeFrom={
                rangeState.mode === "custom" ? rangeState.from : undefined
              }
              rangeTo={rangeState.mode === "custom" ? rangeState.to : undefined}
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
