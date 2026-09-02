// app/observations/page.tsx
"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  Binoculars,
  ExternalLink,
} from "lucide-react";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DBQLAdvancedSearch from "@/components/dbql/DBQLAdvancedSearch";
import PageHeader from "@/components/PageHeader";
import AssigneeSelect from "@/components/AssigneeSelect";
import type { IObservation } from "@/models/Observation";
import { ObservationsReport } from "./components";
import ExportSplitButton from "@/components/ExportSplitButton";
import { PaginationInfo } from "@/components/PaginationInfo";
import type { IUser } from "@/models/User";

export default function ObservationsPage() {
  const { data: session, status } = useSession();

  const [observations, setObservations] = useState<IObservation[]>([]);

  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de paginação
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize] = useState(20); // mesmo valor do limit

  const [searchQuery, setSearchQuery] = useState("");

  const [sortBy, setSortBy] = useState<string>("firstSeen");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const componentRef = useRef<HTMLDivElement>(null);
  const [reportObservations, setReportObservations] = useState<IObservation[]>(
    [],
  );

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "Relatorio_Observations",
    onAfterPrint: () => {
      setReportObservations([]);
      setLoading(false);
    },
  });

  // Ref para rastrear a última query buscada (apenas informativo)
  const lastSearchQueryRef = useRef<string | null>(null);

  // Carregar usuários (uma vez)
  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    const fetchBaseData = async () => {
      try {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) setUsers(await usersRes.json());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Erro ao carregar usuários: ", message);
      }
    };
    fetchBaseData();
  }, [session, status]);

  const fetchObservations = useCallback(
    async (pageNum: number, searchStr: string) => {
      if (status !== "authenticated" || !session) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchStr) params.set("search", searchStr);
        params.set("page", pageNum.toString());
        params.set("limit", pageSize.toString());

        const res = await fetch(`/api/observations?${params}`);
        if (!res.ok) throw new Error("Erro ao carregar Observations");
        const data = await res.json();
        setObservations(data.observations);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0); // ← novo campo
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [session, status, pageSize],
  );

  // Handler de busca (usado pelo DBQLAdvancedSearch)
  const handleSearch = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);
    setPage(1);
    lastSearchQueryRef.current = newQuery;
  }, []);

  // Buscar sempre que page ou searchQuery mudar
  useEffect(() => {
    const task = queueMicrotask(() => {
      void fetchObservations(page, searchQuery);
    });

    return () => {
      void task;
    };
  }, [page, searchQuery, fetchObservations]);

  // Mapa de usuários para exibição
  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.sub] = u.name || u.email;
    });
    return map;
  }, [users]);

  // Ordenação
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedItems = useMemo(() => {
    const items = [...observations];
    return items.sort((a, b) => {
      let valA: unknown = a[sortBy as keyof IObservation];
      let valB: unknown = b[sortBy as keyof IObservation];

      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";

      if (
        sortBy === "firstSeen" ||
        sortBy === "lastSeen" ||
        sortBy === "slaDueAt"
      ) {
        const timeA = valA ? new Date(String(valA)).getTime() : 0;
        const timeB = valB ? new Date(String(valB)).getTime() : 0;
        return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const stringA = String(valA).toLowerCase();
      const stringB = String(valB).toLowerCase();

      if (stringA < stringB) return sortOrder === "asc" ? -1 : 1;
      if (stringA > stringB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [observations, sortBy, sortOrder]);

  // Atualizar responsável (otimista)
  const updateIssue = async (issueId: string, value: string | null) => {
    setObservations((prev) =>
      prev.map((obs) =>
        obs._id.toString() === issueId
          ? ({ ...obs, assignedTo: value || undefined } as IObservation)
          : obs,
      ),
    );

    try {
      const res = await fetch("/api/observations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, assignedTo: value || null }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Erro ao atualizar observação: " + message);
      fetchObservations(page, searchQuery);
    }
  };

  // Buscar todas as observações filtradas (para exportação)
  const fetchAllFilteredObservations = async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    params.set("all", "true");
    const res = await fetch(`/api/observations?${params}`);
    if (!res.ok) throw new Error("Erro ao buscar dados completos");
    const data = await res.json();
    return data.observations as IObservation[];
  };

  // Exportar Excel
  const handleExportExcel = async () => {
    if (!confirm("Exportar todos os resultados atuais para Excel?")) return;
    try {
      const fullObservations = await fetchAllFilteredObservations();
      if (!fullObservations || fullObservations.length === 0)
        return alert("Nenhuma issue para exportar");

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Observations");

      ws.columns = [
        { key: "project", width: 20 },
        { key: "repository", width: 25 },
        { key: "branch", width: 15 },
        { key: "filePath", width: 45 },
        { key: "category", width: 30 },
        { key: "status", width: 15 },
        { key: "azureLink", width: 20 },
        { key: "severity", width: 15 },
        { key: "slaHours", width: 15 },
        { key: "hitCount", width: 10 },
        { key: "justificativa", width: 30 },
      ];

      ws.views = [{ state: "frozen", ySplit: 5 }];

      ws.mergeCells("A1:K1");
      const titleCell = ws.getCell("A1");
      titleCell.value = "Debit Board - Executive Report (Observations)";
      titleCell.font = {
        name: "Arial",
        size: 16,
        bold: true,
        color: { argb: "003366" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(1).height = 30;

      ws.mergeCells("A2:K2");
      const subtitleCell = ws.getCell("A2");
      subtitleCell.value = "Relatório Geral de Vulnerabilidades de Projetos";
      subtitleCell.font = {
        name: "Arial",
        size: 12,
        italic: true,
        color: { argb: "666666" },
      };
      subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(2).height = 20;

      ws.mergeCells("A3:K3");
      const timestampCell = ws.getCell("A3");
      timestampCell.value = `Exportado por DebitBoard em ${new Date().toLocaleString()}`;
      timestampCell.font = {
        name: "Arial",
        size: 10,
        color: { argb: "999999" },
      };
      timestampCell.alignment = { vertical: "middle", horizontal: "left" };

      ws.getRow(4).height = 10;

      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 10 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E293B" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      const headers = [
        "Projeto",
        "Repositório",
        "Branch",
        "Arquivo",
        "Categoria",
        "Status",
        "Azure",
        "Severidade",
        "SLA (Horas)",
        "Hits",
        "Justificativa",
      ];
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      ws.autoFilter = { from: "A5", to: "K5" };

      const totalObservations = fullObservations.length;
      const totalOpen = fullObservations.filter(
        (i) => i.status === "open" || i.status === "recurring",
      ).length;
      const totalResolved = fullObservations.filter(
        (i) => i.status === "resolved",
      ).length;
      const totalProjects = new Set(fullObservations.map((i) => i.project))
        .size;

      ws.getCell("L1").value = "Total Itens:";
      ws.getCell("M1").value = totalObservations;
      ws.getCell("L2").value = "Abertos:";
      ws.getCell("M2").value = totalOpen;
      ws.getCell("L3").value = "Resolvidos:";
      ws.getCell("M3").value = totalResolved;
      ws.getCell("L4").value = "Projetos:";
      ws.getCell("M4").value = totalProjects;

      fullObservations.forEach((issue, index) => {
        const rowNumber = 6 + index;
        const row = ws.getRow(rowNumber);

        const azureSettings = session?.user?.azureSettings;
        const instanceUrl = azureSettings?.instanceUrl || "";
        const azureCollection = azureSettings?.azureCollection || "";
        const azureUrl = `${instanceUrl}/tfs/${azureCollection}/${issue.project}/_git/${issue.repository}?path=${issue.filePath}&version=GB${issue.branch}&_a=contents`;

        row.getCell("project").value = issue.project || "";
        row.getCell("repository").value = issue.repository || "";
        row.getCell("branch").value = issue.branch;
        row.getCell("filePath").value = issue.filePath;
        row.getCell("category").value = issue.category;
        row.getCell("status").value = issue.status;
        row.getCell("azureLink").value = {
          text: "Ver no Azure",
          hyperlink: azureUrl,
        };
        row.getCell("severity").value = issue.severity;
        row.getCell("slaHours").value = issue.slaHours;
        row.getCell("hitCount").value = issue.hitCount;
        row.getCell("justificativa").value = "";

        row.alignment = { vertical: "middle" };
        row.getCell("status").alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        row.getCell("severity").alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        row.getCell("hitCount").alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        row.getCell("azureLink").alignment = {
          horizontal: "center",
          vertical: "middle",
        };

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "E5E7EB" } },
            left: { style: "thin", color: { argb: "E5E7EB" } },
            bottom: { style: "thin", color: { argb: "E5E7EB" } },
            right: { style: "thin", color: { argb: "E5E7EB" } },
          };
        });

        const statusCell = row.getCell("status");
        if (
          issue.status === "new" ||
          issue.status === "open" ||
          issue.status === "recurring"
        ) {
          statusCell.font = { color: { argb: "991B1B" }, bold: true };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FEE2E2" },
          };
        } else if (issue.status === "resolved") {
          statusCell.font = { color: { argb: "065F46" }, bold: true };
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "D1FAE5" },
          };
        }

        const sevCell = row.getCell("severity");
        if (issue.severity === "critical") {
          sevCell.font = { color: { argb: "991B1B" }, bold: true };
          sevCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FECACA" },
          };
        } else if (issue.severity === "high") {
          sevCell.font = { color: { argb: "9A3412" }, bold: true };
          sevCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDD5" },
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Observations_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Erro na exportação Excel: " + message);
    }
  };

  // Exportar PDF (dispara impressão quando reportObservations é preenchido)
  useEffect(() => {
    if (reportObservations.length > 0) {
      handlePrint();
    }
  }, [reportObservations, handlePrint]);

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const fullObservations = await fetchAllFilteredObservations();
      setReportObservations(fullObservations);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert("Erro na geração do PDF: " + message);
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    recurring:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    resolved:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    wont_fix:
      "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20",
  };

  const severityColors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400",
    medium:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400",
  };

  const thClass =
    "px-3 py-2 border-r text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-apple-border-light/30 transition-colors";
  const borderColumnHeader = "flex items-center justify-center gap-1";

  if (status === "loading" || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-[#1C1C1E]">
        <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-apple-bg-light dark:bg-apple-bg-dark">
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          <ObservationsReport
            observations={reportObservations}
            usersMap={usersMap}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full mx-auto p-8 space-y-6">
          <PageHeader
            title="Observations Feed"
            subtitle="Central de monitoramento de vulnerabilidades. Identifique, analise e delegue."
            icon={<Binoculars className="w-10 h-10 text-apple-blue" />}
            actions={
              <div className="flex items-center gap-2">
                <ExportSplitButton
                  onExportPDF={handleExportPDF}
                  onExportExcel={handleExportExcel}
                />
              </div>
            }
          />

          <DBQLAdvancedSearch
            onSearch={handleSearch}
            userId={session.user.id || ""}
            context="observations"
            placeholder="Buscar via DBQL (ex: severity:critical AND status:open)"
          />

          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-apple-border-light dark:border-apple-border-dark">
              <h3 className="text-sm font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">
                Observações ({totalItems})
              </h3>
            </div>

            {/* Paginação */}
            <PaginationInfo
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              className="border-b border-apple-border-light dark:border-apple-border-dark"
            />

            <div className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden flex flex-col w-full h-[600px]">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-apple-border-light/20 dark:bg-apple-border-dark/20 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th
                        data-testid="header-status"
                        className={`${thClass} w-[7%] pl-4`}
                        onClick={() => handleSort("status")}
                      >
                        <div className={borderColumnHeader}>
                          Status{" "}
                          {sortBy === "status" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-fileName"
                        className={`${thClass} w-[30%]`}
                        onClick={() => handleSort("fileName")}
                      >
                        <div className="inline-flex items-center">
                          Arquivo / Observação{" "}
                          {sortBy === "fileName" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-category"
                        className={`${thClass} w-[25%]`}
                        onClick={() => handleSort("category")}
                      >
                        <div className="inline-flex items-center">
                          Categoria{" "}
                          {sortBy === "category" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-branch"
                        className={`${thClass} w-[8%]`}
                        onClick={() => handleSort("branch")}
                      >
                        <div className={borderColumnHeader}>
                          Branch{" "}
                          {sortBy === "branch" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-severity"
                        className={`${thClass} w-[8%]`}
                        onClick={() => handleSort("severity")}
                      >
                        <div className={borderColumnHeader}>
                          Severidade{" "}
                          {sortBy === "severity" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-slaDueAt"
                        className={`${thClass} w-[10%]`}
                        onClick={() => handleSort("slaDueAt")}
                      >
                        <div className={borderColumnHeader}>
                          Previsão (SLA){" "}
                          {sortBy === "slaDueAt" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        data-testid="header-assignedTo"
                        className={`${thClass} w-[6%]`}
                        onClick={() => handleSort("assignedTo")}
                      >
                        <div className={borderColumnHeader}>
                          Responsável{" "}
                          {sortBy === "assignedTo" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                      <th className={`${thClass} w-[5%] text-right pr-4`}>
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
                    {loading && observations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-apple-tertiary-light">
                              Carregando observations...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-8 text-center text-apple-red text-sm"
                        >
                          {error}
                        </td>
                      </tr>
                    ) : sortedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-8 text-center text-apple-tertiary-light text-sm"
                        >
                          Nenhuma vulnerabilidade encontrada.
                        </td>
                      </tr>
                    ) : (
                      sortedItems.map((issue) => {
                        const isPastDue =
                          issue.slaDueAt &&
                          new Date(issue.slaDueAt) < new Date();

                        return (
                          <tr
                            key={issue._id.toString()}
                            className="group hover:bg-apple-border-light/10 dark:hover:bg-apple-border-dark/10 transition-colors"
                          >
                            <td className="px-3 py-3 pl-4 align-middle">
                              <span
                                className={`flex items-center justify-around px-2 py-0.5 text-[9px] font-bold ${statusColors[issue.status]}`}
                              >
                                {issue.status.replace("_", " ").toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle min-w-0">
                              <div className="flex flex-col gap-0.5 align-middle">
                                <span
                                  className="text-xs font-semibold align-middle text-apple-label-light dark:text-apple-label-dark truncate"
                                  title={issue.fileName}
                                >
                                  <Link
                                    href={`/observations/${issue._id}`}
                                    title="Ver Detalhes"
                                    className="inline-flex hover:text-apple-blue hover:border-b-blue-500 items-center justify-center transition-colors"
                                  >
                                    {issue.fileName}{" "}
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                  </Link>
                                </span>
                                <span
                                  className="text-[10px] align-middle font-mono text-apple-tertiary-light truncate"
                                  title={issue.filePath}
                                >
                                  {issue.filePath}
                                </span>
                                <span className="text-[10px] align-middle font-medium text-apple-tertiary-light w-fit">
                                  {issue.hitCount}{" "}
                                  {issue.hitCount === 1 ? "hit" : "hits"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span
                                className="text-xs truncate text-apple-label-light dark:text-apple-label-dark leading-relaxed block"
                                title={issue.category}
                              >
                                {issue.category}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span className="text-xs flex items-center justify-center font-mono bg-apple-border-light/30 dark:bg-[#2C2C2E] px-1.5 py-0.5 rounded text-apple-tertiary-light whitespace-nowrap">
                                {issue.branch}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span
                                className={`flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${severityColors[issue.severity]}`}
                              >
                                {issue.severity}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              {issue.slaDueAt ? (
                                <div className="flex flex-col gap-0.5 items-center">
                                  <span
                                    className={`text-[10px] from-neutral-50 font-mono ${isPastDue && (issue.status === "open" || issue.status === "recurring") ? "text-apple-red" : "text-apple-label-light dark:text-apple-label-dark"}`}
                                  >
                                    {new Date(
                                      issue.slaDueAt,
                                    ).toLocaleDateString("pt-BR")}
                                  </span>
                                  {(issue.status === "open" ||
                                    issue.status === "recurring") && (
                                    <span
                                      className={`text-[10px] ${isPastDue ? "text-apple-red font-bold" : "text-apple-tertiary-light"}`}
                                    >
                                      {isPastDue
                                        ? `Vencido há ${formatDistanceToNow(new Date(issue.slaDueAt), { locale: ptBR, addSuffix: false })}`
                                        : formatDistanceToNow(
                                            new Date(issue.slaDueAt),
                                            { addSuffix: false, locale: ptBR },
                                          )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-apple-tertiary-light">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 flex items-center justify-center align-middle">
                              <AssigneeSelect
                                users={users}
                                className="mt-2.5 flex items-center justify-center align-middle"
                                value={issue.assignedTo}
                                onChange={(v) =>
                                  updateIssue(issue._id.toString(), v)
                                }
                              />
                            </td>
                            <td className="px-3 py-3 pr-4 align-middle text-right">
                              <Link
                                href={`/observations/${issue._id}`}
                                title="Ver Detalhes"
                                className="inline-flex w-8 h-8 p-2 rounded-lg hover:text-apple-blue border hover:border-blue-500 bg-apple-border-light/30 items-center justify-center text-apple-tertiary-light dark:text-apple-label-dark transition-colors"
                              >
                                <ExternalLink className="w-4 h-4 font-extralight" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-apple-border-light dark:border-apple-border-dark bg-white dark:bg-[#1C1C1E]">
                  <span className="text-xs text-apple-tertiary-light">
                    Página {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Página anterior"
                      className="p-1 rounded hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      aria-label="Próxima página"
                      className="p-1 rounded hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )} */}
            </div>

            {/* Paginação */}
            <PaginationInfo
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              className="border-b border-apple-border-light dark:border-apple-border-dark"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
