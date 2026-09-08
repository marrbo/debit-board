"use client";

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { exportDashboardPDF } from "@/utils/exportDashboardPDF";
import PageHeader from "@/components/PageHeader";
import { ChartAreaIcon, Check, ChevronDown, FileText } from "lucide-react";
import TeamStatsCard from "@/components/TeamStatsCard";
import { DataTable, type Column } from "@/components/DataTable";

// Coluna do Grid (agora recebendo dados da rota /api/dashboard/stats)
const columns: Column<any>[] = [
  { key: "name", width:'250px', label: "Projeto", sortable: true },
  {
    key: "observationSeverityCounts",
    label: "Severidade",
    sortable: false,
    width: '260px',
    className: "hover:scale-150 hover:translate-x-6",
    render: (item: any, extraData?: Record<string, any>) => {
      const stats = extraData?.[item.name] || {};
      const sev = stats.severity || {};

      const severityItems = [
        { letter: 'C', count: sev.critical || 0, color: '#ef4444', label: 'Critical' },
        { letter: 'H', count: sev.high || 0, color: '#f97316', label: 'High' },
        { letter: 'M', count: sev.medium || 0, color: '#eab308', label: 'Medium' },
        { letter: 'L', count: sev.low || 0, color: '#22c55e', label: 'Low' },
      ];

      return (
        <div className="flex items-center gap-2">
          {severityItems.map((sevItem) => (
            <div
              key={sevItem.letter}
              className="flex flex-col items-center gap-0.5"
              title={`${sevItem.label}: ${sevItem.count}`}
            >
              {/* Escudo SVG com a letra */}
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
              {/* Contagem abaixo do escudo */}
              <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                {sevItem.count}
              </span>
            </div>
          ))}
        </div>
      );
    },
  },
  { key: "description", label: "Descrição", sortable: true, exportable: false, className: 'text-ellipsis text-muted italic font-mono text-xs line-clamp-1 text-wrap ' },
  {
    key: "lastScan",
    label: "Last scan",
    sortable: true,
    width: '120px',
    align: 'center',
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

  const [teamId, setTeamId] = useState(searchParams.get('teamId') || '');
  const [teamName, setTeamName] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<any>({
    teamStats: { total: 0, severityTotals: {}, statusTotals: {}, categoryTotals: {} },
    projectStats: {}
  });

  const [projects, setProjects] = useState<any[]>([]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return '';
    const selected = teams.find(t => t._id === teamId);
    return selected?.isGlobal ? 'all' : teamId;
  }, [teamId, teams]);

  useEffect(() => {
    fetch("/api/teams")
      .then(res => res.json())
      .then(json => {
        const allTeams = json.data || [];
        setTeams(allTeams);
        const globalTeam = allTeams.find((t: any) => t.isGlobal);
        const nonGlobalTeams = allTeams.filter((t: any) => !t.isGlobal);
        if (!teamId && allTeams.length > 0) {
          if (nonGlobalTeams.length === 1) {
            setTeamId(nonGlobalTeams[0]._id);
          } else {
            setTeamId(globalTeam?._id || allTeams[0]._id);
          }
        }
      })
      .catch(() => setTeams([]));
  }, [teamId]);

  useEffect(() => {
    if (!effectiveTeamId) return;
    const params = new URLSearchParams({ teamId: effectiveTeamId, range: "30d" });
    if (searchTerm) params.set('q', searchTerm);
    
    fetch(`/api/dashboard/stats?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        if (text) {
          try {
            const data = JSON.parse(text);
            setStats(data);
          } catch (e) {
            console.error('Erro ao parsear JSON de stats:', e);
            setStats({ teamStats: { total: 0, severityTotals: {}, statusTotals: {}, categoryTotals: {} }, projectStats: {} });
          }
        } else {
          setStats({ teamStats: { total: 0, severityTotals: {}, statusTotals: {}, categoryTotals: {} }, projectStats: {} });
        }
      })
      .catch(err => {
        console.error('Erro ao buscar stats:', err);
        setStats({ teamStats: { total: 0, severityTotals: {}, statusTotals: {}, categoryTotals: {} }, projectStats: {} });
      });
  }, [effectiveTeamId, searchTerm]);

  // 🔹 Handler de busca simplificado
  const handleSearch = useCallback((newQuery: string) => {
    setSearchTerm(newQuery);
  }, []);

  useEffect(() => {
    if (!effectiveTeamId) return;
    const params = new URLSearchParams({ teamId: effectiveTeamId, page: "1", limit: "100", sort: "name", order: "asc" });
    if (searchTerm) params.set('q', searchTerm);
    
    fetch(`/api/dashboard?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        if (text) {
          try {
            const json = JSON.parse(text);
            setProjects(json.data || []);
          } catch (e) {
            console.error('Erro ao parsear JSON de projetos:', e);
            setProjects([]);
          }
        } else {
          setProjects([]);
        }
      })
      .catch(err => {
        console.error('Erro ao buscar projetos:', err);
        setProjects([]);
      });
  }, [effectiveTeamId, searchTerm]);

  const handleExportPDF = useCallback(async () => {
    // 🔥 Busca todos os projetos com filtros atuais
    const params = new URLSearchParams({
      teamId: effectiveTeamId,
      all: 'true', // Força a API a retornar todos
      sort: 'name',
      order: 'asc',
    });

    if (searchTerm) params.set('q', searchTerm);

    const res = await fetch(`/api/dashboard?${params.toString()}`);
    if (!res.ok) {
      alert('Erro ao buscar dados para exportação');
      return;
    }

    const json = await res.json();
    const allProjects = json.data || [];

    // 🔥 Enriquecer com stats por projeto
    const projectsForPDF = allProjects.map((p: any) => {
      const projectStat = stats.projectStats?.[p.name] || {};
      return {
        name: p.name,
        description: p.description,
        lastScan: p.syncDate ? new Date(p.syncDate).toLocaleDateString('pt-BR') : '—',
        severity: projectStat.severity || {},
      };
    });

    await exportDashboardPDF({
      teamName: teamName,
      generatedAt: new Date(),
      teamStats: stats.teamStats,
      projectStats: stats.projectStats,
      projects: projectsForPDF,
      categoryDetails: stats.categoryDetails,
    });
  }, [effectiveTeamId, searchTerm, stats, teamName]);

  if (status === "loading") return <div className="py-10 text-center">Carregando...</div>;
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
          type: 'advanced',
          onSearch: handleSearch,
          userId: session?.user?._id?.toString() || session?.user?.id,
          placeholder: "Filtrar stats, e.g. severity:critical OR project:my-api",
          context: "observations"
        }}
        actions={
          <div className="flex items-center gap-3">
            {/* 🔥 Botão Exportar PDF */}
            <button
              onClick={handleExportPDF}
              disabled={projects.length === 0}
              className="flex items-center group gap-2 px-4 py-2 rounded-2xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden group-hover:block">Relatório PDF</span>
              <FileText className="w-4 h-4" />
            </button>

            {/* Seletor de Time */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-page dark:bg-surface border border-default dark:border-strong text-heading dark:text-heading px-4 py-2 rounded-2xl text-sm font-medium hover:bg-apple-tertiary-light/10 transition-all focus:outline-none"
              >
                <span className="font-bold">
                  {teams.find(t => t._id === teamId)?.name || "Selecione um Time"}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-surface border border-default dark:border-strong rounded-xl shadow-sm hover:drop-shadow-lg z-20 overflow-hidden">
                  {teams.map((team) => (
                    <button
                      key={team._id}
                      onClick={() => {
                        setTeamId(team._id);
                        setTeamName(team.name);
                        setDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-apple-tertiary-light/10 transition-colors ${
                        teamId === team._id
                          ? "bg-apple-tertiary-light/5 font-semibold text-brand"
                          : "text-heading dark:text-heading"
                      }`}
                    >
                      <span className="truncate">
                        {team.isGlobal ? `${team.name} (Todos)` : team.name}
                      </span>
                      {teamId === team._id && <Check className="w-4 h-4 text-brand" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
      />

      {teamId ? (
        <>
          {/* Top Cards (usando teamStats) */}
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

          {/* Projects Table (usando a rota /api/dashboard e projectStats para extraData) */}
          <div className="pt-4 border-t border-default dark:border-strong">
            <h3 className="text-lg font-semibold mb-4">
              Projetos - {effectiveTeamId == 'all' ? 'Global' : teamName}
            </h3>
            <DataTable
              endpoint="/api/dashboard"
              columns={columns}
              defaultSort={{ field: "name", order: "asc" }}
              defaultLimit={10}
              pdfTitle={`Projetos: Severidades - ${effectiveTeamId == 'all' ? 'Global' : teamName}`}
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
    <Suspense fallback={<div className="py-12 text-center">Carregando dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}