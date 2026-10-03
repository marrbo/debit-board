// app/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tv } from "lucide-react";
import { FaFilePdf } from "react-icons/fa";

import PageHeader from "@/components/PageHeader/Header";
import TeamSelector from "@/components/TeamSelector";
import RangeSelector from "@/components/RangeSelector";
import WidgetsMenu from "@/components/dashboard/WidgetsMenu";
import DashboardProfileBar from "@/components/dashboard/DashboardProfileBar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import DashboardProfileModal from "@/app/settings/dashboards/DashboardProfileModal";
import EvolutionWidget from "@/components/dashboard/EvolutionWidget";
import TopProjectsWidget from "@/components/dashboard/TopProjectsWidget";
import CategoryPieWidget from "@/components/dashboard/CategoryPieWidget";
import Loading from "@/components/Loading";
import HeaderActions from "@/components/PageHeader/HeaderActions";

import {
  renderDashboardWidget,
  WIDGETS_NEEDING_DASHBOARD_STATS,
  WIDGETS_NEEDING_STATS,
} from "@/components/dashboard/widget-renderer";

import { useTeam, useLocalSettings } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";
import { useRangeState } from "@/hooks/useRangeState";
import { useDashboardProfiles } from "@/hooks/useDashboardProfiles";
import { useFeedback } from "@/hooks/useFeedback";
import {
  DASHBOARD_WIDGETS,
  useDashboardLayout,
} from "@/hooks/useDashboardLayout";

import { writeRangeState } from "@/lib/range-options";
import { exportDashboardPDF } from "@/utils/exportDashboardPDF";

import type {
  DashboardProjectStat,
  DashboardStatsResponse,
  StatsData,
} from "@/types/IStats";
import type { IDashboardWidgetRef } from "@/types/IDashboardProfile";

// ============================================================
// Span → classe Tailwind
// ============================================================
const SPAN_CLASS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};

// ============================================================
// Fallbacks
// ============================================================
const EMPTY_DASHBOARD_STATS: DashboardStatsResponse = {
  teamStats: {
    total: 0,
    severityTotals: {},
    statusTotals: {},
    categoryTotals: {},
    categoryGroupTotals: {},
  },
  projectStats: {},
  categoryDetails: {},
};

const EMPTY_STATS: StatsData = {
  kpi: {
    total: 0,
    open: 0,
    recurring: 0,
    resolved: 0,
    wontFix: 0,
    accepted: 0,
    expired: 0,
  },
  severityTotals: {},
  categoryTotals: [],
  projectTotals: [],
  chartData: [],
};

// ============================================================
// Dashboard
// ============================================================
function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teamId, setTeamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  const [searchDbqlId, setSearchDbqlId] = useState(searchParams.get("q") || "");
  const [searchVersion, setSearchVersion] = useState(0);
  const { state: rangeState, rangeKey } = useRangeState();
  const { toast } = useFeedback();

  const { settings, update } = useLocalSettings();
  const activeProfileId = settings.dashboardProfileId;

  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const { profiles, updateLayout, refresh } = useDashboardProfiles();
  const activeProfile = profiles.find(
    (p) => p._id.toString() === activeProfileId,
  );

  const overrideLayout = useMemo(
    () => (activeProfile?.kind === "dashboard" ? activeProfile.layout : null),
    [activeProfile],
  );

  const {
    allWidgets,
    widgets,
    toggle,
    move,
    setSpan,
    reset,
    isDirty,
    draftLayout,
    discardDraft,
  } = useDashboardLayout({
    overrideLayout,
    overrideKey: activeProfileId ?? undefined,
  });

  useEffect(() => {
    if (!activeProfileId) return;
    if (profiles.length === 0) return;
    const exists = profiles.some((p) => p._id.toString() === activeProfileId);
    if (!exists) update({ dashboardProfileId: null });
  }, [activeProfileId, profiles, update]);

  const handleSaveToProfile = useCallback(async () => {
    if (!activeProfileId || !draftLayout) return;
    setSavingProfile(true);
    try {
      await updateLayout(activeProfileId, draftLayout);
      toast.success("Layout salvo no perfil.");
      discardDraft();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar layout.",
      );
    } finally {
      setSavingProfile(false);
    }
  }, [activeProfileId, draftLayout, updateLayout, discardDraft, toast]);

  useEffect(() => {
    if (!activeProfile?.tv?.teamId) return;
    if (activeProfile.kind !== "dashboard") return;
    setTeamId(activeProfile.tv.teamId.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?._id]);

  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse>(
    EMPTY_DASHBOARD_STATS,
  );
  const [stats, setStats] = useState<StatsData>(EMPTY_STATS);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const visibleWidgetIds = useMemo(
    () =>
      widgets
        .map((w) => w.id)
        .sort()
        .join(","),
    [widgets],
  );
  const visibleIds = useMemo(
    () => new Set(visibleWidgetIds.split(",").filter(Boolean)),
    [visibleWidgetIds],
  );

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  const teamName = useMemo(
    () => teams.find((t) => t._id === teamId)?.name ?? "",
    [teams, teamId],
  );

  const tvHref = useMemo(() => {
    const params = new URLSearchParams();
    if (effectiveTeamId !== "all") params.set("teamId", effectiveTeamId);
    if (searchDbqlId) params.set("q", searchDbqlId);
    writeRangeState(rangeState, params);
    const qs = params.toString();
    return qs ? `/tv?${qs}` : "/tv";
  }, [effectiveTeamId, searchDbqlId, rangeState]);

  // ============================================================
  // Fetch condicional (listas vindas do renderer compartilhado)
  // ============================================================
  useEffect(() => {
    if (!teamsLoaded || !effectiveTeamId) return;

    const needsDashboardStats = WIDGETS_NEEDING_DASHBOARD_STATS.some((id) =>
      visibleIds.has(id),
    );
    const needsStats = WIDGETS_NEEDING_STATS.some((id) => visibleIds.has(id));

    if (!needsDashboardStats && !needsStats) return;

    let cancelled = false;

    const buildBase = () => {
      const params = new URLSearchParams({ teamId: effectiveTeamId });
      writeRangeState(rangeState, params);
      if (searchDbqlId) params.set("q", searchDbqlId);
      return params.toString();
    };

    const tasks: Array<{
      key: "dashboardStats" | "stats";
      promise: Promise<unknown>;
    }> = [];

    if (needsDashboardStats) {
      tasks.push({
        key: "dashboardStats",
        promise: fetch(`/api/dashboard/stats?${buildBase()}`).then((r) =>
          r.ok ? r.json() : null,
        ),
      });
    }
    if (needsStats) {
      tasks.push({
        key: "stats",
        promise: fetch(`/api/stats?${buildBase()}`, {
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : null)),
      });
    }

    Promise.all(tasks.map((t) => t.promise))
      .then((results) => {
        if (cancelled) return;
        results.forEach((json, i) => {
          const { key } = tasks[i];
          if (key === "dashboardStats") {
            setDashboardStats(
              (json as DashboardStatsResponse | null) ?? EMPTY_DASHBOARD_STATS,
            );
          } else {
            setStats((json as StatsData | null) ?? EMPTY_STATS);
          }
        });
      })
      .catch((err) => {
        console.error("Erro no carregamento do dashboard:", err);
        if (cancelled) return;
        if (needsDashboardStats) setDashboardStats(EMPTY_DASHBOARD_STATS);
        if (needsStats) setStats(EMPTY_STATS);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teamsLoaded,
    effectiveTeamId,
    searchDbqlId,
    rangeKey,
    searchVersion,
    visibleWidgetIds,
  ]);

  const currentLayoutSnapshot: IDashboardWidgetRef[] = useMemo(
    () =>
      allWidgets.map((w) => ({
        widgetId: w.id,
        visible: w.visible,
        order: w.order,
        span: w.span,
      })),
    [allWidgets],
  );

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
      const projectStat: DashboardProjectStat =
        dashboardStats.projectStats?.[p.name];
      return {
        name: p.name,
        description: p.description,
        lastScan: p.syncDate
          ? new Date(p.syncDate).toLocaleDateString("pt-BR")
          : "—",
        severity: projectStat?.severity || {},
      };
    });

    await exportDashboardPDF({
      teamName,
      generatedAt: new Date(),
      teamStats: dashboardStats.teamStats,
      projectStats: dashboardStats.projectStats,
      projects: projectsForPDF,
      categoryDetails: dashboardStats.categoryDetails,
    });
  }, [effectiveTeamId, searchDbqlId, rangeState, dashboardStats, teamName]);

  if (status === "loading") return <Loading />;

  if (!session) {
    router.push("/login");
    return null;
  }

  if (!teamsLoaded) {
    return (
      <div className="w-full p-8 space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        search={{
          type: "advanced",
          onSearch: handleSearch,
          userSub: session?.user?.sub,
          placeholder:
            "Filtrar dashboard, ex: severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={
          <div className="flex items-center gap-1">
            <HeaderActions
              href={tvHref}
              target="_blank"
              rel="noopener noreferrer"
              tooltip="Modo TV"
              color="warning"
            >
              <Tv />
            </HeaderActions>

            <RangeSelector />

            <HeaderActions
              onClick={handleExportPDF}
              disabled={!teamsLoaded}
              tooltip="Resumo Executivo (PDF)"
              color="error"
            >
              <FaFilePdf />
            </HeaderActions>

            <div
              className="w-px h-5 border-r bg-default mx-1"
              aria-hidden="true"
            />

            <DashboardProfileBar />
            <WidgetsMenu
              widgets={allWidgets}
              onToggle={toggle}
              onMove={move}
              onSpanChange={setSpan}
              onReset={reset}
              activeProfileName={activeProfile?.name ?? null}
              isDirty={isDirty}
              onSave={handleSaveToProfile}
              onSaveAs={() => setSaveAsOpen(true)}
              saving={savingProfile}
            />

            <div className="w-px h-5 border-r mx-1" aria-hidden="true" />

            <TeamSelector teams={teams} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        {DASHBOARD_WIDGETS.map((meta) => {
          const w = widgets.find((x) => x.id === meta.id);
          if (!w) return null;
          return (
            <div
              key={`${w.id}-${w.span}`}
              style={{ order: w.order }}
              className={`min-w-0 ${SPAN_CLASS[w.span] ?? "lg:col-span-6"}`}
            >
              {renderDashboardWidget(w.id, {
                stats,
                dashboardStats,
                teamId: effectiveTeamId,
                teamName,
                searchDbqlId,
                rangeState,
                searchVersion,
                onExpand: setExpandedChart,
                variant: "dashboard",
              })}
            </div>
          );
        })}
      </div>

      {expandedChart && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-elevated border border-default rounded-lg shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-default shrink-0">
              <h3 className="text-base font-semibold text-heading">
                {expandedChart === "evolution" && "Evolução das ocorrências"}
                {expandedChart === "top-projects" && "Top projetos"}
                {expandedChart === "category-pie" &&
                  "Distribuição por Categoria"}
              </h3>
              <button
                type="button"
                onClick={() => setExpandedChart(null)}
                className="btn-ghost text-error"
                title="Fechar"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 p-6 overflow-hidden">
              <div className="w-full h-full">
                {expandedChart === "evolution" && (
                  <EvolutionWidget chartData={stats.chartData} fillContainer />
                )}
                {expandedChart === "top-projects" && (
                  <TopProjectsWidget
                    projects={stats.projectTotals}
                    limit={12}
                    fillContainer
                  />
                )}
                {expandedChart === "category-pie" && (
                  <CategoryPieWidget
                    categories={stats.categoryTotals}
                    fillContainer
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {saveAsOpen && (
        <DashboardProfileModal
          initialLayout={currentLayoutSnapshot}
          defaultKind="dashboard"
          onClose={() => setSaveAsOpen(false)}
          onSaved={async (created) => {
            setSaveAsOpen(false);
            await refresh();
            update({ dashboardProfileId: created._id.toString() });
          }}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full p-8">
          <LoadingSkeleton />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
