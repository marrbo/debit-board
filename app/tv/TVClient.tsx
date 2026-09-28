// app/tv/TVClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Calendar, Loader2, X } from "lucide-react";
import TeamStatsCard from "@/components/TeamStatsCard";
import TeamsExecutiveCard from "@/components/stats/TeamsExecutiveCard";
import EvolutionWidget from "@/components/dashboard/EvolutionWidget";
import TopProjectsWidget from "@/components/dashboard/TopProjectsWidget";
import CategoryPieWidget from "@/components/dashboard/CategoryPieWidget";
import { DataTable } from "@/components/DataTable";
import { projectColumns } from "@/components/dashboard/projectColumns";
import TVControls from "./TVControls";
import { useRangeState } from "@/hooks/useRangeState";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardProfiles } from "@/hooks/useDashboardProfiles";
import { useTeams } from "@/hooks/useTeams";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { writeRangeState } from "@/lib/range-options";
import type { StatsData, DashboardStatsResponse } from "@/types/IStats";

const DEFAULT_REFRESH = 60;
const SPAN_CLASS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};

// Widgets que consomem /api/stats
const TV_IDS_NEEDING_STATS = [
  "severity-status",
  "evolution",
  "category-pie",
  "category",
  "top-projects",
] as const;

// Widget que consome /api/dashboard/stats (coluna severidade do grid
// de projetos — `extraData`)
const TV_ID_NEEDING_DASHBOARD_STATS = "projects-table";

function parseRefresh(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parseBool(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

/**
 * Modo TV. Carrega o perfil (`?profile=`) quando informado, cuja
 * `layout` sobrepõe o storage local. Ciclo de times: quando ativo, o
 * `teamId` efetivo é o time na posição `currentIndex` da lista — e a
 * cada refresh o índice avança com wrap.
 *
 * Todos os widgets do catálogo podem ser exibidos em TV — incluindo o
 * grid de projetos (renderizado como tabela read-only, alimentada pelo
 * mesmo `/api/dashboard/stats` do Dashboard).
 */
export default function TVClient() {
  const searchParams = useSearchParams();
  const { state: rangeState, rangeKey } = useRangeState();
  const { teams, loaded: teamsLoaded } = useTeams();
  const { profiles } = useDashboardProfiles();
  const { settings } = useLocalSettings();

  // Perfil: URL tem prioridade; fallback para o ativo no localStorage
  const urlProfileId = searchParams.get("profile");
  const profileId = urlProfileId ?? settings.dashboardProfileId;
  const profile = profiles.find((p) => p._id.toString() === profileId);

  // Layout: aceita qualquer tipo de perfil (dashboard ou tv)
  const overrideLayout = useMemo(() => profile?.layout ?? null, [profile]);
  const { widgets } = useDashboardLayout({
    overrideLayout,
    overrideKey: profileId ?? undefined,
  });

  const tvConfig = profile?.kind === "tv" ? profile.tv : undefined;

  const urlTeamId = searchParams.get("teamId") ?? "";
  const urlCycle = searchParams.get("cycle");
  const urlRefresh = searchParams.get("refresh");

  const cycleTeams =
    tvConfig?.cycleTeams ?? (urlCycle ? parseBool(urlCycle) : false);
  const fixedTeamId = cycleTeams
    ? null
    : (tvConfig?.teamId ?? (urlTeamId || null));
  const refreshSec = parseRefresh(
    urlRefresh,
    tvConfig?.refreshSec ?? DEFAULT_REFRESH,
  );
  const dbqlId = searchParams.get("q") ?? "";

  // Times com projeto vinculado — evita ciclo com times vazios
  const cycleableTeams = useMemo(
    () => teams.filter((t) => !t.isGlobal && (t.projectCount ?? 0) > 0),
    [teams],
  );

  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);

  /**
   * Time efetivo pronto para a URL do endpoint. Nunca retorna `null`:
   * quando não há time específico (Global), usa `"all"`.
   */
  const teamIdForApi = useMemo(() => {
    if (cycleTeams && cycleableTeams.length > 0) {
      return cycleableTeams[
        currentTeamIndex % cycleableTeams.length
      ]._id.toString();
    }
    if (fixedTeamId && String(fixedTeamId) !== "all") {
      return String(fixedTeamId);
    }
    return "all";
  }, [cycleTeams, cycleableTeams, currentTeamIndex, fixedTeamId]);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [dashboardStats, setDashboardStats] =
    useState<DashboardStatsResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const visibleIds = useMemo(
    () => new Set(widgets.map((w) => w.id)),
    [widgets],
  );

  const fetchAll = useCallback(async () => {
    const needsStats = TV_IDS_NEEDING_STATS.some((id) => visibleIds.has(id));
    const needsDashboardStats = visibleIds.has(TV_ID_NEEDING_DASHBOARD_STATS);

    if (!needsStats && !needsDashboardStats) {
      setLoading(false);
      return;
    }

    try {
      const baseParams = new URLSearchParams();
      if (teamIdForApi !== "all") {
        baseParams.set("teamId", teamIdForApi);
      }
      if (dbqlId) baseParams.set("q", dbqlId);
      writeRangeState(rangeState, baseParams);
      const qs = baseParams.toString();

      const tasks: Array<{
        key: "stats" | "dashboardStats";
        promise: Promise<Response>;
      }> = [];
      if (needsStats) {
        tasks.push({
          key: "stats",
          promise: fetch(`/api/stats?${qs}`, { cache: "no-store" }),
        });
      }
      if (needsDashboardStats) {
        tasks.push({
          key: "dashboardStats",
          promise: fetch(`/api/dashboard/stats?${qs}`, {
            cache: "no-store",
          }),
        });
      }

      const responses = await Promise.all(tasks.map((t) => t.promise));
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          throw new Error(`${tasks[i].key}: HTTP ${responses[i].status}`);
        }
      }
      const jsons = await Promise.all(responses.map((r) => r.json()));
      for (let i = 0; i < jsons.length; i++) {
        if (tasks[i].key === "stats") setStats(jsons[i] as StatsData);
        else setDashboardStats(jsons[i] as DashboardStatsResponse);
      }

      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdForApi, dbqlId, rangeKey, visibleIds]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const cycleRef = useRef(cycleTeams);
  useEffect(() => {
    cycleRef.current = cycleTeams;
  }, [cycleTeams]);

  useEffect(() => {
    if (paused || refreshSec === 0) return;
    const id = setInterval(() => {
      if (cycleRef.current && cycleableTeams.length > 0) {
        setCurrentTeamIndex((i) => (i + 1) % cycleableTeams.length);
      } else {
        fetchAll();
      }
    }, refreshSec * 1000);
    return () => clearInterval(id);
  }, [fetchAll, paused, refreshSec, cycleableTeams.length]);

  useEffect(() => {
    if (!cycleTeams) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeamIndex, cycleTeams]);

  const statusTotals = useMemo(
    () => ({
      open: stats?.kpi?.accepted || 0,
      resolved: stats?.kpi?.resolved || 0,
      recurring: stats?.kpi?.recurring || 0,
      wont_fix: stats?.kpi?.wontFix || 0,
    }),
    [stats],
  );

  const secondsUntilRefresh = useMemo(() => {
    if (paused || refreshSec === 0 || !lastUpdate) return null;
    const elapsed = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    return Math.max(0, refreshSec - elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate, refreshSec, paused, tick]);

  const currentTeamName = useMemo(() => {
    if (cycleTeams && cycleableTeams.length > 0) {
      return cycleableTeams[currentTeamIndex % cycleableTeams.length].name;
    }
    if (teamIdForApi === "all") return "Global";
    return teams.find((t) => t._id.toString() === teamIdForApi)?.name ?? "—";
  }, [cycleTeams, cycleableTeams, currentTeamIndex, teamIdForApi, teams]);

  const rangeLabel = useMemo(() => {
    if (rangeState.mode === "custom" && rangeState.from && rangeState.to) {
      return "Personalizado";
    }
    const map: Record<string, string> = {
      "1h": "1 hora",
      "24h": "24 horas",
      "7d": "7 dias",
      "14d": "14 dias",
      "30d": "30 dias",
      "90d": "90 dias",
      all: "Tudo",
    };
    return map[rangeState.preset] ?? "Tudo";
  }, [rangeState]);

  const renderWidget = (id: string) => {
    switch (id) {
      case "severity-status":
        return (
          <TeamStatsCard
            type="status"
            title="Severidade e Status"
            total={stats?.kpi?.total ?? 0}
            severity={stats?.severityTotals ?? {}}
            status={statusTotals}
          />
        );
      case "evolution":
        return (
          <EvolutionWidget chartData={stats?.chartData ?? []} height={360} />
        );
      case "executive":
        // 🔑 `teamIdForApi` nunca é "null" — cai em "all" (Global),
        //    que o endpoint interpreta como "todos os times".
        return (
          <TeamsExecutiveCard teamId={teamIdForApi} searchQuery={dbqlId} />
        );
      case "category-pie":
        return <CategoryPieWidget categories={stats?.categoryTotals ?? []} />;
      case "category":
        return (
          <TeamStatsCard
            type="category"
            title="Distribuição por Categoria"
            total={stats?.kpi?.total ?? 0}
            category={Object.fromEntries(
              (stats?.categoryTotals ?? []).map((c) => [c.label, c.value]),
            )}
            categoryGroup={stats?.categoryGroupTotals}
          />
        );
      case "top-projects":
        return (
          <TopProjectsWidget
            projects={stats?.projectTotals ?? []}
            height={420}
            limit={10}
          />
        );
      case "projects-table":
        // Grid de projetos em modo leitura — sem export (não faz
        // sentido em TV). A coluna de severidade usa o `extraData` de
        // `/api/dashboard/stats`, mesma fonte do Dashboard.
        return (
          <div className="w-full">
            <h3 className="text-lg font-semibold mb-4 text-heading">
              Projetos - {currentTeamName}
            </h3>
            <DataTable
              endpoint="/api/dashboard"
              columns={projectColumns}
              defaultSort={{ field: "name", order: "asc" }}
              defaultLimit={5}
              teamId={teamIdForApi}
              range={
                rangeState.mode === "preset" && rangeState.preset !== "all"
                  ? rangeState.preset
                  : undefined
              }
              rangeFrom={
                rangeState.mode === "custom" ? rangeState.from : undefined
              }
              rangeTo={rangeState.mode === "custom" ? rangeState.to : undefined}
              searchDbqlId={dbqlId}
              extraData={dashboardStats?.projectStats ?? {}}
              exportPDF={false}
              pdfTitle={`Projetos: Severidades - ${currentTeamName}`}
              onRowClick={() => {}}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dark fixed inset-0 z-[9999] bg-page text-body overflow-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-6 px-8 py-4 bg-elevated border-b border-default">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-xl font-bold text-heading truncate">
            Security Posture - {currentTeamName}
          </h1>
          <span className="text-muted truncate flex items-start justify-start">
            {cycleTeams && cycleableTeams.length > 1 && (
              <span className="ml-2 px-1.5 flex items-center rounded bg-brand/15 text-brand text-[12px] font-mono">
                {(currentTeamIndex % cycleableTeams.length) + 1}/
                {cycleableTeams.length}
                {" | "}
              </span>
            )}
            <span className="flex items-center text-muted gap-1">
              <Calendar size={14} /> {rangeLabel}
            </span>
          </span>
        </div>

        <TVControls
          refreshSec={refreshSec}
          paused={paused}
          secondsUntilRefresh={secondsUntilRefresh}
          lastUpdate={lastUpdate}
          onTogglePause={() => setPaused((p) => !p)}
          cycleTeams={cycleTeams}
          cycleableTeamCount={cycleableTeams.length}
          onToggleCycleTeams={() => {
            setCurrentTeamIndex(0);
            const params = new URLSearchParams(searchParams.toString());
            if (cycleTeams) params.delete("cycle");
            else params.set("cycle", "1");
            const qs = params.toString();
            window.history.replaceState(
              null,
              "",
              qs ? `?${qs}` : window.location.pathname,
            );
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        />

        <Link
          href="/"
          className="btn-ghost shrink-0"
          title="Sair do modo TV"
          aria-label="Sair do modo TV"
        >
          <X className="w-5 h-5" />
        </Link>
      </header>

      {error && (
        <div className="mx-8 mt-6 flex items-start gap-3 bg-error-50 dark:bg-error-500/10 border border-error-500/30 rounded-lg p-4 text-error">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Falha ao carregar dados</p>
            <p className="text-xs mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {!teamsLoaded || (loading && !stats && !dashboardStats) ? (
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-10 h-10 animate-spin text-brand" />
        </div>
      ) : widgets.length === 0 ? (
        <div className="flex items-center justify-center h-[60vh] text-muted">
          Nenhum widget visível. Personalize o Dashboard para exibir widgets
          aqui.
        </div>
      ) : (
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
            {widgets.map((w) => (
              <div
                key={`${w.id}-${w.effectiveSpan}`}
                style={{ order: w.order }}
                className={`min-w-0 ${
                  SPAN_CLASS[w.effectiveSpan] ?? "lg:col-span-6"
                }`}
              >
                {renderWidget(w.id)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
