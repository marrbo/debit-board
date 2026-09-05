"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import type { Column } from '@/components/DataTable';
import TeamStatsCard from "@/components/TeamStatsCard";

// const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
//   open: { label: "Novo", bg: "bg-blue-100", color: "text-blue-600" },
//   resolved: { label: "Corrigido", bg: "bg-green-100", color: "text-green-600" },
//   recurring: { label: "Recorrente", bg: "bg-red-100", color: "text-red-600" },
//   wont_fix: { label: "Não Corrigir", bg: "bg-gray-100", color: "text-gray-600" },
// };

// Coluna do Grid (agora recebendo dados da rota /api/dashboard/stats)
const columns: Column<any>[] = [
  { key: "name", width:'250px', label: "Projeto", sortable: true },
  {
    key: "observationSeverityCounts",
    label: "Severidade",
    sortable: false,
    width: '250px',
    render: (item: any, extraData?: Record<string, any>) => {
      const stats = extraData?.[item.name] || {};
      const sev = stats.severity || {};

      return (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-4 gap-2 hover:scale-150">
            <div className="px-2 py-1 flex flex-col text-center p-2 rounded-lg hover:scale-150 bg-red-100 text-red-600 text-xs font-bold">
              {sev.critical || 0}
              <span className="text-[7px] text-xs text-red-600/50 align-center uppercase">critical</span>
            </div>
            
            <div className="px-2 py-1 flex flex-col text-center rounded-lg hover:scale-150 bg-orange-100 text-orange-600 text-xs font-bold">
              {sev.high || 0}
              <span className="text-[7px] text-xs text-orange-600/50 uppercase">high</span>
            </div>
            <div className="px-2 py-1 flex flex-col text-center rounded-lg hover:scale-150 bg-yellow-100 text-yellow-600 text-xs font-bold">
              {sev.medium || 0}
              <span className="text-[7px] text-xs text-yellow-600/50 uppercase">medium</span>
            </div>
            <div className="p-2 py-1 flex flex-col text-center rounded-lg hover:scale-150 bg-green-100 text-green-600 text-xs font-bold">
              {sev.low || 0}
              <span className="text-[7px] text-xs text-green-600/50 uppercase">low</span>
            </div>
          </div>
        </div>
      );
    },
  },
  { key: "description", label: "Descrição", sortable: true, className: 'text-ellipsis text-apple-tertiary-light italic font-mono text-xs line-clamp-1 text-wrap ' },
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
  const [teams, setTeams] = useState<any[]>([]);
  const [effectiveTeamId, setEffectiveTeamId] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // ID da query DBQL

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dados dos Cards e do Grid (vindo da rota dedicada /api/dashboard/stats)
  const [stats, setStats] = useState<any>({
    teamStats: { total: 0, severityTotals: {}, statusTotals: {}, categoryTotals: {} },
    projectStats: {}
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca os Teams (Prioridade: Global ou único time)
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
            setEffectiveTeamId(nonGlobalTeams[0]._id);
          } else {
            setTeamId(globalTeam?._id || allTeams[0]._id);
            setEffectiveTeamId(globalTeam ? 'all' : allTeams[0]._id);
          }
        }
      });
  }, []);

  useEffect(() => {
    if (!teamId) return;
    const selected = teams.find(t => t._id === teamId);
    if (selected?.isGlobal) setEffectiveTeamId('all');
    else setEffectiveTeamId(teamId);
  }, [teamId, teams]);

  // 🔥 Busca as Stats na nova Rota Dedicada (com DBQL aplicado)
  useEffect(() => {
    if (!effectiveTeamId) return;
    
    const params = new URLSearchParams({
      teamId: effectiveTeamId,
      range: "30d"
    });
    
    if (searchTerm) params.set('q', searchTerm);

    fetch(`/api/dashboard/stats?${params.toString()}`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, [effectiveTeamId, searchTerm]);

  if (status === "loading") return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do time selecionado."
        actions={
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark px-4 py-2 rounded-2xl text-sm font-medium hover:bg-apple-tertiary-light/10 transition-all focus:outline-none"
            >
              <span className="font-bold">
                {teams.find(t => t._id === teamId)?.name || "Selecione um Time"}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-lg z-20 overflow-hidden">
                {teams.map((team) => (
                  <button
                    key={team._id}
                    onClick={() => {
                      const newTeamId = team.isGlobal ? 'all' : team._id;
                      setTeamId(team._id);
                      setEffectiveTeamId(newTeamId);
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-apple-tertiary-light/10 transition-colors ${
                      teamId === team._id
                        ? "bg-apple-tertiary-light/5 font-semibold text-apple-blue"
                        : "text-apple-label-light dark:text-apple-label-dark"
                    }`}
                  >
                    <span className="truncate">
                      {team.isGlobal ? `${team.name} (Todos)` : team.name}
                    </span>
                    {teamId === team._id && <Check className="w-4 h-4 text-apple-blue" />}
                  </button>
                ))}
              </div>
            )}
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
              title="Categoria"
              total={stats.teamStats.total}
              category={stats.teamStats.categoryTotals}
            />
          </div>

          {/* Projects Table (usando a rota /api/dashboard e projectStats para extraData) */}
          <div className="pt-4 border-t border-apple-border-light dark:border-apple-border-dark">
            <h3 className="text-lg font-semibold mb-4">Projetos do Time</h3>
            <DataTable
              endpoint="/api/dashboard"
              columns={columns}
              defaultSort={{ field: "name", order: "asc" }}
              defaultLimit={10}
              searchPlaceholder="Buscar Projetos (ex: name:debit-board)"
              searchContext="projects"
              userId={session?.user?._id?.toString()}
              teamId={effectiveTeamId}
              extraData={stats.projectStats} // 🔥 Usa o map de stats dedicado
              onSearchChange={(value) => setSearchTerm(value)}
              onRowClick={() => {}}
            />
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-apple-tertiary-light">
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