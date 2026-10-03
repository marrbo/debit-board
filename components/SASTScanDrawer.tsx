//components/SASTScanDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import Loading from "@/components/Loading";
import { BAND_META, type RiskBand } from "@/lib/risk";
import ScoreGauge from "./ScoreGauge";
import {
  formatDuration,
  formatPct,
  shortScanId,
  shortPatternId,
  ORIGIN_LABEL,
  STATUS_LABEL,
  STATUS_CLASS,
  SEVERITY_LABEL,
  SEVERITY_STYLE,
  type ScanStatus,
} from "@/lib/sast";

type Severity = "low" | "medium" | "high" | "critical";

interface SASTScanDetail {
  _id: string;
  scanId?: string;
  origin: string;
  scanDate: string;
  completedAt?: string;
  status: ScanStatus;
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
  riskScore?: number;
  riskBand?: RiskBand;
  profileName?: string | null;
  rerunOfScanId?: string | null;
  durationMs?: number | null;
}

interface SASTPatternResult {
  patternId: string;
  dbId: string | null;
  dbName: string | null;
  name: string | null;
  query: string | null;
  category: string;
  severity: Severity;
  slaHours: number;
  hitCount: number;
  error: string | null;
  score: number | null;
  externalId: string | null;
  externalLink: string | null;
}
interface SASTScanResultDetail {
  patterns: SASTPatternResult[];
  totalOccurrences: number;
  failedPatterns: number;
}

interface ApiResponse {
  scan: SASTScanDetail;
  result: SASTScanResultDetail | null;
  isAdmin: boolean;
  risk: { score: number; band: RiskBand };
}

interface ConsolidatedRow {
  category: string;
  patternCount: number;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  failed: number;
}

export type SASTRerunPayload =
  | { rerunOfScanId: string; mode: "full" | "failed" }
  | { patternIds: string[] };

export interface SASTScanDrawerProps {
  scanId: string | null;
  onClose: () => void;
  onRerun: (payload: SASTRerunPayload) => Promise<void>;
  rerunning: boolean;
}

export default function SASTScanDrawer({
  scanId,
  onClose,
  onRerun,
  rerunning,
}: SASTScanDrawerProps) {
  const [scan, setScan] = useState<SASTScanDetail | null>(null);
  const [result, setResult] = useState<SASTScanResultDetail | null>(null);
  const [risk, setRisk] = useState<{ score: number; band: RiskBand } | null>(
    null,
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "patterns">(
    "overview",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    setExpandedCategories(new Set());
    setActiveTab("overview");

    fetch(`/api/sast/scans/${scanId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao carregar scan.");
        return data as ApiResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setScan(data.scan);
        setResult(data.result);
        setIsAdmin(data.isAdmin);
        setRisk(data.risk ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scanId]);

  const groupedPatterns = useMemo(() => {
    if (!result) return [] as Array<[string, SASTPatternResult[]]>;
    const groups = new Map<string, SASTPatternResult[]>();
    for (const p of result.patterns) {
      const arr = groups.get(p.category) ?? [];
      arr.push(p);
      groups.set(p.category, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [result]);

  const consolidated = useMemo<ConsolidatedRow[]>(() => {
    if (!result) return [];
    const map = new Map<string, ConsolidatedRow>();

    for (const p of result.patterns) {
      const row = map.get(p.category) ?? {
        category: p.category,
        patternCount: 0,
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        failed: 0,
      };
      row.patternCount += 1;
      row.total += p.hitCount;
      row[p.severity] += p.hitCount;
      if (p.error) row.failed += 1;
      map.set(p.category, row);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [result]);

  const allPatternIds = useMemo(
    () => (result ? result.patterns.map((p) => p.patternId) : []),
    [result],
  );

  const toggleOne = (patternId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) next.delete(patternId);
      else next.add(patternId);
      return next;
    });
  };

  const toggleGroup = (items: SASTPatternResult[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((p) => next.has(p.patternId));
      items.forEach((p) =>
        allSelected ? next.delete(p.patternId) : next.add(p.patternId),
      );
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allPatternIds));
  const clearAll = () => setSelectedIds(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleRunFull = () => {
    if (!scan) return;
    onRerun({ rerunOfScanId: scan._id, mode: "full" });
  };

  const handleRunFailed = () => {
    if (!scan) return;
    onRerun({ rerunOfScanId: scan._id, mode: "failed" });
  };

  const handleRunSelected = () => {
    if (selectedIds.size === 0) return;
    onRerun({ patternIds: Array.from(selectedIds) });
  };

  const isOpen = Boolean(scanId);
  const hasFailures = (scan?.failedPatterns ?? 0) > 0;
  const isRunnable = scan?.status === "completed" || scan?.status === "failed";
  const selectedCount = selectedIds.size;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        scan ? (
          <div className="flex items-center gap-3">
            {risk && (
              <ScoreGauge score={risk.score} size={44} variant="compact" />
            )}
            <span className="truncate font-mono">
              {scan.scanId ?? shortScanId(scan._id)}
            </span>
          </div>
        ) : (
          "Scan"
        )
      }
      subtitle={
        scan ? new Date(scan.scanDate).toLocaleString("pt-BR") : undefined
      }
    >
      {loading && !scan ? (
        <Loading label="Carregando scan…" />
      ) : error ? (
        <div className="p-6">
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-lg p-3 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : scan ? (
        <>
          {/* KPIs */}
          {/* Linha de identificação: origem + perfil */}
          <div className="flex items-center gap-3 px-6 pt-4 text-xs">
            <span className="text-muted">Origem:</span>
            <span className="text-heading font-medium">
              {ORIGIN_LABEL[scan.origin] ?? scan.origin}
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">Perfil:</span>
            <span className="text-heading font-medium">
              {scan.rerunOfScanId ? (
                <span className="text-blue-400">Re-run</span>
              ) : (
                (scan.profileName ?? <span className="italic">Default</span>)
              )}
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6 pb-4">
            <KpiCard
              label="Status"
              value={
                <span className={`font-medium ${STATUS_CLASS[scan.status]}`}>
                  {STATUS_LABEL[scan.status]}
                </span>
              }
            />
            <KpiCard label="Patterns" value={scan.patternCount} />
            <KpiCard label="Ocorrências" value={scan.totalOccurrences} />
            <KpiCard
              label="Falhas"
              value={scan.failedPatterns}
              tone={hasFailures ? "error" : "default"}
            />
            <KpiCard
              label="Duração"
              value={
                <span className="tabular-nums">
                  {formatDuration(scan.durationMs)}
                </span>
              }
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 px-6">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Overview"
            />
            <TabButton
              active={activeTab === "patterns"}
              onClick={() => setActiveTab("patterns")}
              icon={<Shield className="w-4 h-4" />}
              label="Patterns"
            />
          </div>

          {activeTab === "overview" ? (
            <OverviewPanel rows={consolidated} scan={scan} risk={risk} />
          ) : (
            <PatternsPanel
              result={result}
              groupedPatterns={groupedPatterns}
              selectedIds={selectedIds}
              selectedCount={selectedCount}
              expandedCategories={expandedCategories}
              isAdmin={isAdmin}
              isRunnable={isRunnable}
              rerunning={rerunning}
              hasFailures={hasFailures}
              onToggleOne={toggleOne}
              onToggleGroup={toggleGroup}
              onToggleCategory={toggleCategory}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              onRunFull={handleRunFull}
              onRunFailed={handleRunFailed}
              onRunSelected={handleRunSelected}
            />
          )}
        </>
      ) : null}
    </Drawer>
  );
}

/* ============================================================
   Subcomponentes
   ============================================================ */

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "error";
}

function KpiCard({ label, value, tone = "default" }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "error"
          ? "border-red-700/30 bg-red-900/10"
          : "border-gray-800 bg-[#161b22]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-500 text-blue-400"
          : "border-transparent text-gray-400 hover:text-gray-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------- Overview ---------- */

interface OverviewPanelProps {
  rows: ConsolidatedRow[];
  scan: SASTScanDetail;
  risk: { score: number; band: RiskBand } | null;
}

function OverviewPanel({ rows, scan, risk }: OverviewPanelProps) {
  const totals = useMemo(() => {
    const acc = {
      patternCount: 0,
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      failed: 0,
    };
    for (const r of rows) {
      acc.patternCount += r.patternCount;
      acc.total += r.total;
      acc.critical += r.critical;
      acc.high += r.high;
      acc.medium += r.medium;
      acc.low += r.low;
      acc.failed += r.failed;
    }
    return acc;
  }, [rows]);

  return (
    <div className="p-6 space-y-6 overflow-x-auto">
      {/* Risk card */}
      {risk && (
        <div
          className={`rounded-lg border p-4 flex items-center gap-5 ${BAND_META[risk.band].bg} ${BAND_META[risk.band].border}`}
        >
          <ScoreGauge score={risk.score} size={110} />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">
              Risco do scan
            </div>
            <div
              className={`text-xl font-semibold ${BAND_META[risk.band].text}`}
            >
              {BAND_META[risk.band].label}
            </div>
            <p className="text-xs text-gray-300 mt-1 max-w-md">
              {BAND_META[risk.band].executive}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {BAND_META[risk.band].specialist}
            </p>
          </div>
        </div>
      )}

      {/* Consolidado por categoria */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum dado consolidado disponível para este scan.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase text-gray-500">
              Consolidado por categoria
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">
              {rows.length}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="text-left py-2 font-medium">Categoria</th>
                <th className="text-right py-2 font-medium">Padrões</th>
                <th className="text-right py-2 font-medium">Total</th>
                <th className="text-right py-2 font-medium">Crítico</th>
                <th className="text-right py-2 font-medium">Alto</th>
                <th className="text-right py-2 font-medium">Médio</th>
                <th className="text-right py-2 font-medium">Baixo</th>
                <th className="text-right py-2 font-medium">Falhas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.category}
                  className="border-b border-gray-900 hover:bg-white/[0.02]"
                >
                  <td className="py-2 text-white">{row.category}</td>
                  <td className="py-2 text-right text-gray-300">
                    {row.patternCount}
                  </td>
                  <td className="py-2 text-right text-white font-semibold">
                    {row.total}
                  </td>
                  <SeverityCell
                    value={row.critical}
                    total={row.total}
                    tone="critical"
                  />
                  <SeverityCell
                    value={row.high}
                    total={row.total}
                    tone="high"
                  />
                  <SeverityCell
                    value={row.medium}
                    total={row.total}
                    tone="medium"
                  />
                  <SeverityCell value={row.low} total={row.total} tone="low" />
                  <td className="py-2 text-right">
                    {row.failed > 0 ? (
                      <span className="text-red-400 font-semibold">
                        {row.failed}
                      </span>
                    ) : (
                      <span className="text-gray-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-white/[0.02]">
                <td className="py-2 text-gray-300 font-semibold">
                  Total geral
                </td>
                <td className="py-2 text-right text-gray-200 font-semibold">
                  {totals.patternCount}
                </td>
                <td className="py-2 text-right text-white font-semibold">
                  {totals.total}
                </td>
                <td className="py-2 text-right text-red-400 font-semibold">
                  {totals.critical}
                </td>
                <td className="py-2 text-right text-orange-400 font-semibold">
                  {totals.high}
                </td>
                <td className="py-2 text-right text-amber-400 font-semibold">
                  {totals.medium}
                </td>
                <td className="py-2 text-right text-emerald-400 font-semibold">
                  {totals.low}
                </td>
                <td className="py-2 text-right font-semibold">
                  {totals.failed > 0 ? (
                    <span className="text-red-400">{totals.failed}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-[11px] text-gray-500">
            Total de ocorrências do scan:{" "}
            <span className="text-gray-300 font-medium">
              {scan.totalOccurrences}
            </span>
            {totals.total === scan.totalOccurrences ? (
              <span className="ml-2 text-emerald-400">✓ consistente</span>
            ) : (
              <span className="ml-2 text-amber-400">
                ⚠ divergência de{" "}
                {Math.abs(totals.total - scan.totalOccurrences)}
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}

interface SeverityCellProps {
  value: number;
  total: number;
  tone: "critical" | "high" | "medium" | "low";
}

const TONE_COLOR: Record<SeverityCellProps["tone"], string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-emerald-400",
};

function SeverityCell({ value, total, tone }: SeverityCellProps) {
  if (value === 0) {
    return (
      <td className="py-2 text-right">
        <span className="text-gray-600">0</span>
      </td>
    );
  }
  return (
    <td className="py-2 text-right">
      <span className={`font-semibold ${TONE_COLOR[tone]}`}>{value}</span>
      <span className="text-[10px] text-gray-500 ml-1">
        {formatPct(value, total)}
      </span>
    </td>
  );
}

/* ---------- Patterns ---------- */

interface PatternsPanelProps {
  result: SASTScanResultDetail | null;
  groupedPatterns: Array<[string, SASTPatternResult[]]>;
  selectedIds: Set<string>;
  selectedCount: number;
  expandedCategories: Set<string>;
  isAdmin: boolean;
  isRunnable: boolean;
  rerunning: boolean;
  hasFailures: boolean;
  onToggleOne: (patternId: string) => void;
  onToggleGroup: (items: SASTPatternResult[]) => void;
  onToggleCategory: (category: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRunFull: () => void;
  onRunFailed: () => void;
  onRunSelected: () => void;
}

function PatternsPanel({
  result,
  groupedPatterns,
  selectedIds,
  selectedCount,
  expandedCategories,
  isAdmin,
  isRunnable,
  rerunning,
  hasFailures,
  onToggleOne,
  onToggleGroup,
  onToggleCategory,
  onSelectAll,
  onClearAll,
  onRunFull,
  onRunFailed,
  onRunSelected,
}: PatternsPanelProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-6 py-5 border-b border-gray-800">
        <button
          onClick={onRunFull}
          disabled={rerunning || !isRunnable}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {rerunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Re-executar (completo)
        </button>

        {hasFailures && (
          <button
            onClick={onRunFailed}
            disabled={rerunning || !isRunnable}
            className="inline-flex items-center gap-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {rerunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Re-executar apenas falhados
          </button>
        )}

        {selectedCount > 0 && (
          <button
            onClick={onRunSelected}
            disabled={rerunning || !isRunnable}
            className="inline-flex items-center gap-2 border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {rerunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Re-executar selecionados ({selectedCount})
          </button>
        )}

        {!isRunnable && (
          <span className="text-xs text-gray-500">
            Scan não pode ser reexecutado no status atual.
          </span>
        )}
      </div>

      <div className="p-6">
        {!result ? (
          <p className="text-sm text-gray-400">
            Resultado detalhado não disponível para este scan.
          </p>
        ) : result.patterns.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum pattern registrado.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase text-gray-500">
                Patterns executados
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={onSelectAll}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-white/5"
                >
                  Selecionar todos
                </button>
                <button
                  onClick={onClearAll}
                  disabled={selectedCount === 0}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-700 text-gray-300 hover:bg-white/5 disabled:opacity-40"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {groupedPatterns.map(([category, items]) => (
                <CategoryAccordion
                  key={category}
                  category={category}
                  items={items}
                  isExpanded={expandedCategories.has(category)}
                  selectedIds={selectedIds}
                  isAdmin={isAdmin}
                  onToggleCategory={() => onToggleCategory(category)}
                  onToggleGroup={() => onToggleGroup(items)}
                  onTogglePattern={onToggleOne}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

interface CategoryAccordionProps {
  category: string;
  items: SASTPatternResult[];
  isExpanded: boolean;
  selectedIds: Set<string>;
  isAdmin: boolean;
  onToggleCategory: () => void;
  onToggleGroup: () => void;
  onTogglePattern: (patternId: string) => void;
}

function CategoryAccordion({
  category,
  items,
  isExpanded,
  selectedIds,
  isAdmin,
  onToggleCategory,
  onToggleGroup,
  onTogglePattern,
}: CategoryAccordionProps) {
  const totalHits = items.reduce((sum, p) => sum + p.hitCount, 0);
  const selectedInGroup = items.filter((p) =>
    selectedIds.has(p.patternId),
  ).length;
  const allSelected = items.length > 0 && selectedInGroup === items.length;
  const someSelected = selectedInGroup > 0 && !allSelected;

  return (
    <div className="rounded-lg border border-gray-800 bg-[#161b22] overflow-hidden">
      <div className="flex items-center">
        {/* Checkbox do grupo — fora do botão para não togglar o accordion */}
        <label
          className="pl-4 pr-1 py-3 flex items-center cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleGroup}
            className="w-4 h-4 accent-brand rounded border-gray-600"
            aria-label={`Selecionar todos os patterns de ${category}`}
          />
        </label>

        {/* Botão do accordion */}
        <button
          type="button"
          onClick={onToggleCategory}
          aria-expanded={isExpanded}
          className="flex-1 flex items-center gap-3 pr-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <ChevronRight
            className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />

          <span className="text-sm font-semibold text-white flex-1 truncate">
            {category}
          </span>

          {selectedInGroup > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-300 bg-blue-500/10">
              {selectedInGroup} sel.
            </span>
          )}

          <span className="text-[11px] text-gray-400 whitespace-nowrap">
            {items.length} {items.length === 1 ? "pattern" : "patterns"}
          </span>

          {totalHits > 0 && (
            <span className="text-[11px] text-gray-500 whitespace-nowrap">
              · {totalHits} hits
            </span>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-800 p-3 space-y-2">
          {items.map((pattern) => (
            <PatternCard
              key={pattern.patternId}
              pattern={pattern}
              selected={selectedIds.has(pattern.patternId)}
              isAdmin={isAdmin}
              onToggle={() => onTogglePattern(pattern.patternId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PatternCardProps {
  pattern: SASTPatternResult;
  selected: boolean;
  isAdmin: boolean;
  onToggle: () => void;
}

function PatternCard({
  pattern,
  selected,
  isAdmin,
  onToggle,
}: PatternCardProps) {
  const failed = Boolean(pattern.error);
  const displayName = pattern.name ?? shortPatternId(pattern.patternId);
  const identifierLabel = pattern.dbId ?? shortPatternId(pattern.patternId);
  const showQuery = isAdmin && pattern.query;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        selected ? "border-brand/40 bg-brand/5" : "border-gray-800 bg-[#0f1318]"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 w-4 h-4 accent-brand rounded border-gray-600 shrink-0"
        aria-label={`Selecionar ${displayName}`}
      />

      <div className="pt-0.5 shrink-0">
        {failed ? (
          <XCircle className="w-4 h-4 text-red-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Identifier estável — vem antes do nome */}
          <span
            className="text-[10px] font-mono font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded"
            title="Identificador estável do Debit-Board"
          >
            {identifierLabel}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {displayName}
          </span>
          <span
            className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[pattern.severity]}`}
          >
            {pattern.severity}
          </span>
        </div>

        {showQuery ? (
          <code className="block mt-1 text-[11px] text-gray-400 font-mono break-all">
            {pattern.query}
          </code>
        ) : (
          <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed">
            <div>
              <span className="text-gray-500">Risco: </span>
              <span className="text-gray-300">
                {pattern.score !== null && `${pattern.score.toFixed(1)} `}
                {SEVERITY_LABEL[pattern.severity]} Risk
              </span>
            </div>
            {pattern.externalId && (
              <div>
                <span className="text-gray-500">Referência: </span>
                {pattern.externalLink ? (
                  <a
                    href={pattern.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {pattern.externalId}
                  </a>
                ) : (
                  <span className="text-gray-300">{pattern.externalId}</span>
                )}
              </div>
            )}
          </div>
        )}

        {failed && pattern.error && (
          <p className="mt-1 text-[11px] text-red-400 break-all">
            {pattern.error}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs text-gray-500">hits</div>
        <div className="text-sm font-semibold text-white">
          {pattern.hitCount}
        </div>
      </div>
    </div>
  );
}
