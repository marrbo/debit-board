// components/dashboard/SASTTimelineWidget.tsx
"use client";

import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import ScoreGauge from "@/components/ScoreGauge";
import ScanRiskTimeline from "@/components/ScanRiskTimeline";
import { useSASTTimeline } from "@/hooks/useSASTTimeline";
import { BAND_META, bandOf } from "@/lib/risk";

interface SASTTimelineWidgetProps {
  limit?: number;
  teamId?: string | null;
  /** DBQL — filtra as observations que alimentam o risco. */
  dbqlId?: string | null;
}

/**
 * Widget de evolução de risco — auto-contido, com fetch próprio.
 *
 * Estrutura espelha os demais widgets do dashboard (`h-full flex flex-col`).
 * O gráfico preenche a altura disponível via `fillContainer`, sem esticar.
 */
export default function SASTTimelineWidget({
  limit = 15,
  teamId,
  dbqlId,
}: SASTTimelineWidgetProps) {
  const {
    points,
    tenantReference,
    loading,
    error,
    refresh,
    latest,
    average,
    delta,
  } = useSASTTimeline({ limit, teamId, dbqlId });

  const isImproving = delta < 0;
  const isWorsening = delta > 0;
  const trendTone = isImproving
    ? "text-emerald-400"
    : isWorsening
      ? "text-red-400"
      : "text-gray-400";
  const trendLabel = isImproving
    ? "Melhora"
    : isWorsening
      ? "Piora"
      : "Estável";
  const TrendIcon = isImproving
    ? TrendingDown
    : isWorsening
      ? TrendingUp
      : Minus;

  return (
    <div className="bg-elevated border border-default dark:border-none rounded-lg p-5 shadow-sm hover:drop-shadow-lg h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-heading min-w-0 truncate">
          Evolução de Risco
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="btn-ghost p-1.5"
            title="Atualizar"
            aria-label="Atualizar timeline"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          <Link
            href="/sast/timeline"
            className="btn-ghost p-1.5"
            title="Ver timeline completa"
            aria-label="Ver timeline completa"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Corpo */}
      {loading && points.length === 0 ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : error ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center text-sm text-error text-center px-4">
          {error}
        </div>
      ) : !latest ? (
        <div className="flex-1 min-h-[180px] flex items-center justify-center text-muted text-sm text-center px-4">
          Nenhum scan concluído ainda.
        </div>
      ) : (
        <>
          {/* Risco atual + trend */}
          <div className="flex items-center gap-4 mb-4 shrink-0">
            <div className="shrink-0">
              <ScoreGauge
                score={latest.riskScore}
                size={84}
                variant="compact"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-lg font-semibold ${BAND_META[bandOf(latest.riskScore)].text}`}
                >
                  {BAND_META[bandOf(latest.riskScore)].label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${trendTone}`}
                >
                  <TrendIcon className="w-3.5 h-3.5" />
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(0)} · {trendLabel}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">
                Média:{" "}
                <span className="text-heading">{average.toFixed(1)}</span>
                {" · "}
                {points.length} {points.length === 1 ? "scan" : "scans"}
              </p>
            </div>
          </div>

          {/* Mini timeline — ocupa a altura restante */}
          <div className="flex-1 min-h-[110px] relative">
            <ScanRiskTimeline
              points={points}
              height={110}
              compact
              fillContainer
              showCaption={false}
              medianLine={false}
              referencePoints={
                tenantReference.length > 0 ? tenantReference : undefined
              }
            />
          </div>
        </>
      )}

      {/* Footer */}
      <Link
        href="/sast/timeline"
        className="mt-3 inline-flex items-center justify-end gap-1 text-[11px] text-muted hover:text-brand transition-colors shrink-0"
      >
        Ver timeline completa
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
