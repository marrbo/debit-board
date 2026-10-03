// app/sast/timeline/page.tsx
"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader/Header";
import SASTSubnav from "@/components/SASTSubnav";
import TeamSelector from "@/components/TeamSelector";
import Loading from "@/components/Loading";
import RiskBadge from "@/components/RiskBadge";
import ScanRiskTimeline, {
  type TimelineRange,
} from "@/components/ScanRiskTimeline";
import ScoreGauge from "@/components/ScoreGauge";
import { useSASTTimeline } from "@/hooks/useSASTTimeline";
import { useTeam } from "@/hooks/useLocalSettings";
import { useTeams } from "@/hooks/useTeams";
import { BAND_META, bandOf } from "@/lib/risk";

function SASTTimelineContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teamId] = useTeam();
  const { teams, loaded: teamsLoaded } = useTeams();

  const [searchDbqlId, setSearchDbqlId] = useState(searchParams.get("q") || "");

  const effectiveTeamId = useMemo(() => {
    if (!teamId) return "all";
    const selected = teams.find((t) => t._id === teamId);
    return selected?.isGlobal ? "all" : teamId;
  }, [teamId, teams]);

  const { points, tenantReference, loading, error } = useSASTTimeline({
    limit: 30,
    teamId: effectiveTeamId,
    dbqlId: searchDbqlId || null,
  });

  const [range, setRange] = useState<TimelineRange | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchDbqlId(q);
    setRange(null); // limpa seleção ao trocar filtro
  }, []);

  const filtered = useMemo(() => {
    if (!range) return points;
    return points.slice(range.start, range.end + 1);
  }, [points, range]);

  const latest = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  const earliest = filtered.length > 0 ? filtered[0] : null;
  const average =
    filtered.length > 0
      ? filtered.reduce((s, p) => s + p.riskScore, 0) / filtered.length
      : 0;
  const delta = latest && earliest ? latest.riskScore - earliest.riskScore : 0;
  const totalOccurrences = filtered.reduce((s, p) => s + p.totalOccurrences, 0);

  const isImproving = delta < 0;
  const isWorsening = delta > 0;

  if (
    status === "loading" ||
    !teamsLoaded ||
    (loading && points.length === 0)
  ) {
    return <Loading />;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4 p-8">
      <PageHeader
        search={{
          type: "advanced",
          onSearch: handleSearch,
          userSub: session.user.sub,
          placeholder:
            "Filtrar timeline, ex: severity:critical OR project:my-api",
          context: "observations",
        }}
        actions={<TeamSelector teams={teams} />}
      />
      <SASTSubnav />

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {range && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            Filtro ativo:{" "}
            <span className="text-heading font-medium">
              {filtered.length} de {points.length} scans
            </span>
          </span>
          <button
            type="button"
            onClick={() => setRange(null)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-default hover:border-strong hover:text-heading transition-colors"
          >
            <X className="w-3 h-3" /> Limpar seleção
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          className={`rounded-lg border p-4 transition-colors ${
            latest
              ? BAND_META[bandOf(latest.riskScore)].border
              : "border-gray-800"
          }`}
          style={{
            backgroundColor: latest
              ? `color-mix(in srgb, ${BAND_META[bandOf(latest.riskScore)].hex} 5%, var(--bg-page))`
              : "var(--bg-page)",
          }}
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Risco atual
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <div>
              <div className="text-2xl font-semibold text-white tabular-nums">
                {latest?.riskScore ?? "—"}
              </div>
              {latest && (
                <div
                  className={`text-xs ${BAND_META[bandOf(latest.riskScore)].text}`}
                >
                  {BAND_META[bandOf(latest.riskScore)].label}
                </div>
              )}
            </div>
            {latest && (
              <ScoreGauge
                score={latest.riskScore}
                size={72}
                variant="compact"
              />
            )}
          </div>
        </div>

        <StatCard
          label="Média do período"
          value={average.toFixed(1)}
          subtitle={`${filtered.length} ${
            filtered.length === 1 ? "scan" : "scans"
          }`}
          icon={<Activity className="w-4 h-4" />}
        />

        <StatCard
          label="Tendência"
          value={`${delta > 0 ? "+" : ""}${delta.toFixed(0)}`}
          subtitle={
            isImproving
              ? "Redução — postura melhorando"
              : isWorsening
                ? "Aumento — atenção"
                : "Estável"
          }
          tone={isImproving ? "success" : isWorsening ? "error" : "neutral"}
          icon={
            isImproving ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )
          }
        />

        <StatCard
          label="Ocorrências acumuladas"
          value={totalOccurrences.toLocaleString("pt-BR")}
          subtitle="Somatório no período"
          icon={<ShieldAlert className="w-4 h-4" />}
        />
      </div>

      <div className="rounded-lg border border-gray-800 bg-page p-6 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
          <h2 className="text-xs font-semibold uppercase text-gray-500">
            Evolução de Risco
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#60a5fa]" />
              {effectiveTeamId === "all" ? "Risco" : "Time"}
            </span>
            {tenantReference.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#94a3b8]" /> Tenant
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#f59e0b]" /> Tendência
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-px border-t border-dashed"
                style={{ borderColor: "#a78bfa" }}
              />{" "}
              Mediana
            </span>
          </div>
        </div>
        <div className="w-full" style={{ height: 420 }}>
          <ScanRiskTimeline
            points={points}
            height={420}
            fillContainer
            selectable
            selectedRange={range}
            onRangeSelect={setRange}
            referencePoints={
              tenantReference.length > 0 ? tenantReference : undefined
            }
          />
        </div>
      </div>

      <ScanGrid points={filtered} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  tone?: "neutral" | "success" | "error";
  icon?: React.ReactNode;
}

function StatCard({
  label,
  value,
  subtitle,
  tone = "neutral",
  icon,
}: StatCardProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "error"
        ? "text-red-400"
        : "text-white";
  return (
    <div className="rounded-lg border border-gray-800 bg-page p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">
          {label}
        </div>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className={`text-2xl font-semibold mt-2 tabular-nums ${toneClass}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

interface ScanGridProps {
  points: ReturnType<typeof useSASTTimeline>["points"];
}

function ScanGrid({ points }: ScanGridProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-page p-6 text-center text-sm text-gray-400">
        Nenhum scan no período.
      </div>
    );
  }

  const rows = [...points].reverse();

  return (
    <div className="rounded-lg border border-gray-800 bg-page overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase text-gray-500">
          Scans no período
        </h2>
        <span className="text-[11px] text-gray-500">
          {points.length} {points.length === 1 ? "scan" : "scans"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-800">
              <th className="text-left py-2 px-4 font-medium">Data</th>
              <th className="text-right py-2 px-4 font-medium">Risco</th>
              <th
                className="text-right py-2 px-4 font-medium cursor-help"
                title="Diferença de risco em relação ao scan imediatamente anterior. Positivo = piorou; negativo = melhorou; zero = estável."
              >
                Δ
              </th>
              <th className="text-right py-2 px-4 font-medium">Ocorrências</th>
              <th className="text-right py-2 px-4 font-medium">Patterns</th>
              <th className="text-right py-2 px-4 font-medium">Falhas</th>
              <th className="text-left py-2 px-4 font-medium">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const prev = rows[i + 1];
              const delta = prev ? p.riskScore - prev.riskScore : 0;
              const hasPrev = Boolean(prev);
              const isUp = delta > 0;
              const isDown = delta < 0;

              return (
                <tr
                  key={p._id}
                  className="border-b border-gray-900 hover:bg-white/[0.02]"
                >
                  <td className="py-2 px-4 text-white whitespace-nowrap">
                    {new Date(p.scanDate).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <RiskBadge score={p.riskScore} />
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {hasPrev ? (
                      <span
                        className={
                          isUp
                            ? "text-red-400"
                            : isDown
                              ? "text-emerald-400"
                              : "text-gray-500"
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-200 tabular-nums">
                    {p.totalOccurrences}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-300 tabular-nums">
                    {p.patternCount}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {p.failedPatterns > 0 ? (
                      <span className="text-red-400 font-medium">
                        {p.failedPatterns}
                      </span>
                    ) : (
                      <span className="text-gray-600">0</span>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] ${
                        !hasPrev
                          ? "text-gray-600"
                          : isUp
                            ? "text-red-400"
                            : isDown
                              ? "text-emerald-400"
                              : "text-gray-500"
                      }`}
                    >
                      {!hasPrev ? (
                        <>
                          <Minus className="w-3 h-3" /> Baseline
                        </>
                      ) : isUp ? (
                        <>
                          <ArrowUp className="w-3 h-3" /> Piora
                        </>
                      ) : isDown ? (
                        <>
                          <ArrowDown className="w-3 h-3" /> Melhora
                        </>
                      ) : (
                        <>
                          <Minus className="w-3 h-3" /> Estável
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SASTTimelinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <SASTTimelineContent />
    </Suspense>
  );
}
