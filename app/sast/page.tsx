"use client";

import { useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Play, FileText, CheckCircle, XCircle, ShieldKeyhole } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import PageHeader from "@/components/PageHeader";

// ============================================================
// Tipos
// ============================================================
interface PatternResult {
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  slaHours: number;
  hitCount?: number;
  error?: string;
  query?: string; // apenas admin
}

interface SASTResult {
  totalOccurrences: number;
  patternsExecuted: number;
  failedPatterns: number;
  patterns: PatternResult[];
}

const SASTReport = ({ result }: { result: SASTResult | null }) => {
  if (!result) return null;
  return (
    <div className="p-10 bg-white text-black" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="mb-8 border-b border-gray-300 pb-4">
        <h1 className="text-3xl font-bold text-blue-600">Relatório SAST</h1>
        <p className="text-gray-500 text-sm mt-1">Scanner Automático de Segurança</p>
        <p className="text-xs text-gray-400 mt-2">
          Gerado em: {new Date().toLocaleString()}
        </p>
      </div>
      <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
        <p className="text-lg font-bold">
          Total de ocorrências: <span className="text-blue-600">{result.totalOccurrences}</span>
        </p>
        <p className="text-sm text-gray-600">Padrões executados: {result.patternsExecuted}</p>
        {result.failedPatterns > 0 && (
          <p className="text-sm text-red-600">Padrões com falha: {result.failedPatterns}</p>
        )}
      </div>
      <table className="w-full text-sm border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="border border-gray-200 p-2 font-semibold">Categoria</th>
            <th className="border border-gray-200 p-2 font-semibold">Severidade</th>
            <th className="border border-gray-200 p-2 font-semibold">SLA</th>
            <th className="border border-gray-200 p-2 font-semibold text-center">Hits</th>
          </tr>
        </thead>
        <tbody>
          {result.patterns.map((p, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border border-gray-200 p-2 font-medium">{p.category}</td>
              <td className="border border-gray-200 p-2 font-medium uppercase">{p.severity}</td>
              <td className="border border-gray-200 p-2 font-medium">{p.slaHours}h</td>
              <td className="border border-gray-200 p-2 text-center font-bold">
                {p.error ? "Erro" : p.hitCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-4 text-center">
        Relatório gerado automaticamente.
      </p>
    </div>
  );
};

export default function SASTPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.isAdmin === true;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SASTResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Relatorio_SAST",
  });

  const executiveSummary = useMemo(() => {
    if (!result) return [];
    const grouped: Record<string, { total: number; severity: string; slaHours: number }> = {};
    result.patterns.forEach((p) => {
      if (!grouped[p.category]) {
        grouped[p.category] = { total: 0, severity: "low", slaHours: 72 };
      }
      grouped[p.category].total += p.hitCount || 0;
      const severityOrder = ["low", "medium", "high", "critical"];
      if (severityOrder.indexOf(p.severity) > severityOrder.indexOf(grouped[p.category].severity)) {
        grouped[p.category].severity = p.severity;
      }
      if (p.slaHours < grouped[p.category].slaHours) {
        grouped[p.category].slaHours = p.slaHours;
      }
    });
    return Object.entries(grouped).map(([category, data]) => ({ category, ...data }));
  }, [result]);

  const runSAST = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sast/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        let errorMsg = "Erro ao executar Advanced Code Scanner";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = `Erro ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }
      const data: SASTResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido");
      }
    } finally {
      setRunning(false);
    }
  };

  const handlePrintPDF = () => {
    if (!result) return;
    handlePrint();
  };

  // ✅ Espera a sessão carregar antes de decidir
  if (status === "loading") {
    return <div className="py-10 text-center">Carregando...</div>;
  }

  const azureSettings = session?.user?.azureSettings;
  if (!azureSettings || !azureSettings.instanceUrl) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <PageHeader
          title="SAST Scanner"
          subtitle="Executa uma bateria de buscas predefinidas para identificar vulnerabilidades comuns."
          icon={<ShieldKeyhole className="w-6 h-6 text-apple-blue" />}
        />
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-6 text-red-300">
          <p className="font-medium">Acesso negado ao Scanner SAST.</p>
          <p className="text-sm mt-1">
            O Tenant associado não possui configurações do Azure. Contate o Administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-6">
      <PageHeader
        title="SAST Scanner"
        subtitle="Executa uma bateria de buscas predefinidas para identificar vulnerabilidades comuns ( branches main ou master )."
        icon={<ShieldKeyhole className="w-10 h-10 text-apple-blue" />}
      />
      <div className="hidden">
        <div ref={componentRef}>
          <SASTReport result={result} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6">
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={runSAST}
              disabled={running}
              className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue disabled:opacity-50 text-apple-bg-light dark:text-apple-bg-light px-4 py-2 rounded-lg font-medium"
            >
              {running ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Executar Advanced Code Scanner
                </>
              )}
            </button>
            {result && (
              <button
                onClick={handlePrintPDF}
                className="bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Gerar Relatório PDF
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700/30 rounded p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-slate-700">
              <div className="bg-slate-900 border border-gray-200 dark:border-slate-700 rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  {result.failedPatterns > 0 && result.totalOccurrences === 0 ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  )}
                  <p
                    className={`font-medium ${
                      result.failedPatterns > 0 && result.totalOccurrences === 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {result.failedPatterns > 0 && result.totalOccurrences === 0
                      ? "SAST executado com falhas!"
                      : "SAST concluído com sucesso!"}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded p-3 mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">
                    📊 Resumo Executivo por Categoria
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {executiveSummary.map((item) => (
                      <div
                        key={item.category}
                        className="bg-slate-900/80 p-3 rounded border border-gray-200 dark:border-slate-700 flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.category}
                          </p>
                          <div className="flex gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            <span>
                              SLA: <strong className="text-slate-200">{item.slaHours}h</strong>
                            </span>
                            <span>
                              Severidade:{" "}
                              <span
                                className={`uppercase font-bold ${
                                  item.severity === "critical"
                                    ? "text-red-400"
                                    : item.severity === "high"
                                      ? "text-orange-400"
                                      : item.severity === "medium"
                                        ? "text-yellow-400"
                                        : "text-blue-400"
                                }`}
                              >
                                {item.severity}
                              </span>
                            </span>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-amber-400">{item.total}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">
                    🔍 Detalhamento dos Padrões
                  </h3>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Severidade</th>
                        <th className="p-3">SLA (h)</th>
                        {isAdmin && <th className="p-3">Query (Motor)</th>}
                        <th className="p-3 text-center">Hits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {result.patterns.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-3 text-gray-900 dark:text-white">{p.category}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                p.severity === "critical"
                                  ? "bg-red-900/40 text-red-400"
                                  : p.severity === "high"
                                    ? "bg-orange-900/40 text-orange-400"
                                    : p.severity === "medium"
                                      ? "bg-yellow-900/40 text-yellow-400"
                                      : "bg-blue-900/40 text-blue-400"
                              }`}
                            >
                              {p.severity}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300">{p.slaHours}h</td>
                          {isAdmin && (
                            <td className="p-3 font-mono text-slate-300 text-xs break-all">
                              {p.query}
                            </td>
                          )}
                          <td className="p-3 text-center font-bold">
                            {p.error ? (
                              <span className="text-red-400 text-[10px]" title={p.error}>
                                <XCircle className="w-4 h-4 inline-block mr-1" /> Erro
                              </span>
                            ) : (
                              <span className="text-amber-400">{p.hitCount}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}