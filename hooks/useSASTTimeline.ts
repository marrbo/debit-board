// hooks/useSASTTimeline.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RiskBand } from "@/lib/risk";

export interface SASTTimelinePoint {
  _id: string;
  scanDate: string;
  riskScore: number;
  riskBand?: RiskBand;
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
}

export interface TenantReferencePoint {
  _id: string;
  scanDate: string;
  riskScore: number;
}

export interface UseSASTTimelineOptions {
  limit?: number;
  teamId?: string | null;
  /** DBQL. Filtra as observations que alimentam o risco. */
  dbqlId?: string | null;
  autoFetch?: boolean;
}

export interface UseSASTTimelineResult {
  points: SASTTimelinePoint[];
  tenantReference: TenantReferencePoint[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  latest: SASTTimelinePoint | null;
  earliest: SASTTimelinePoint | null;
  average: number;
  delta: number;
}

export function useSASTTimeline(
  options: UseSASTTimelineOptions = {},
): UseSASTTimelineResult {
  const { limit = 30, teamId, dbqlId, autoFetch = true } = options;

  const [points, setPoints] = useState<SASTTimelinePoint[]>([]);
  const [tenantReference, setTenantReference] = useState<
    TenantReferencePoint[]
  >([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTimeline = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (teamId && teamId !== "all") params.set("teamId", teamId);
      if (dbqlId) params.set("q", dbqlId);

      const res = await fetch(`/api/sast/scans/timeline?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao carregar timeline.");
      }
      const json = (await res.json()) as {
        scans?: SASTTimelinePoint[];
        tenantReference?: TenantReferencePoint[];
      };
      setPoints(json.scans ?? []);
      setTenantReference(json.tenantReference ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setPoints([]);
      setTenantReference([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [limit, teamId, dbqlId]);

  useEffect(() => {
    if (!autoFetch) return;
    void fetchTimeline();
    return () => {
      abortRef.current?.abort();
    };
  }, [autoFetch, fetchTimeline]);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const earliest = points.length > 0 ? points[0] : null;
  const average =
    points.length > 0
      ? points.reduce((s, p) => s + p.riskScore, 0) / points.length
      : 0;
  const delta = latest && earliest ? latest.riskScore - earliest.riskScore : 0;

  return {
    points,
    tenantReference,
    loading,
    error,
    refresh: fetchTimeline,
    latest,
    earliest,
    average,
    delta,
  };
}
