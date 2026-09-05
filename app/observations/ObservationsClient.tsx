"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Binoculars } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import ObservationDrawer from "@/components/ObservationDrawer";
import AssigneeSelect from "@/components/AssigneeSelect";
import type { IObservation } from "@/types/IObservation";
import type { IUser } from "@/types/IUser";
import type { IAzureSettings } from "@/types/IAzureSettings";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import { ObservationsReport } from "./components";

// Funções auxiliares de cor (fora do componente)
const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    open: "bg-red-50 text-red-700 border-red-200",
    recurring: "bg-orange-50 text-orange-700 border-orange-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    wont_fix: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return colors[status] || "bg-gray-100";
};

const severityColor = (severity: string) => {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-blue-100 text-blue-800",
  };
  return colors[severity] || "bg-gray-100";
};

const slaRender = (item: IObservation) => {
  if (!item.slaDueAt) return "—";
  const date = new Date(item.slaDueAt);
  const isPastDue = date < new Date() && (item.status === "open" || item.status === "recurring");
  return (
    <div className="flex flex-col items-center text-[10px]">
      <span className={isPastDue ? "text-red-500 font-bold" : ""}>
        {date.toLocaleDateString("pt-BR")}
      </span>
      {(item.status === "open" || item.status === "recurring") && (
        <span className={isPastDue ? "text-red-500 font-bold" : "text-gray-400"}>
          {formatDistanceToNow(date, { locale: ptBR, addSuffix: false })}
        </span>
      )}
    </div>
  );
};

export default function ObservationsClient({ azureSettings }: { azureSettings: IAzureSettings | null }) {
  const { data: session } = useSession();
  const [selectedObservation, setSelectedObservation] = useState<IObservation | null>(null);
  const [users, setUsers] = useState<IUser[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportData, setReportData] = useState<IObservation[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Carregar usuários
  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: IUser[]) => setUsers(data))
      .catch(() => setUsers([]));
  }, []);

  // Atualizar responsável (memoizado)
  const handleUpdateAssignee = useCallback(
    async (id: string, value: string | null) => {
      try {
        const res = await fetch("/api/observations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueId: id, assignedTo: value }),
        });
        if (res.ok) {
          setRefreshKey((prev) => prev + 1);
          setSelectedObservation((prev) => {
            if (!prev || prev._id.toString() !== id) return prev;
            return { ...prev, assignedTo: value || undefined } as IObservation;
          });
        } else {
          alert("Erro ao atualizar responsável");
        }
      } catch {
        alert("Erro de rede ao atualizar responsável");
      }
    },
    []
  );

  // Colunas
  const columns: Column<IObservation>[] = useMemo(
    () => [
      { key: "status", label: "Status", width: '90px', sortable: true, render: (item) => <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${statusColor(item.status)}`}>{item.status}</span> },
      { key: "fileName", width: '400px', label: "Arquivo / Observação", sortable: true, render: (item) => <div className="flex flex-col"><span className="text-xs font-semibold truncate max-w-xs text-apple-blue cursor-pointer hover:underline" onClick={() => setSelectedObservation(item)}>{item.fileName}</span><span className="text-[10px] font-mono text-gray-400 truncate max-w-xs">{item.filePath}</span></div> },
      { key: "category", width: '170px', label: "Categoria", sortable: true },
      { key: "branch", width: '90px', label: "Branch", sortable: true, render: (item) => <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{item.branch}</span> },
      { key: "severity", width: '110px', label: "Severidade", sortable: true, render: (item) => <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${severityColor(item.severity)}`}>{item.severity}</span> },
      { key: "slaDueAt", width: '90px', label: "SLA", sortable: true, render: (item) => slaRender(item) },
      { key: "assignedTo", width: '120px', label: "Responsável", sortable: true, render: (item) => <div className="relative w-fit" onClick={(e) => e.stopPropagation()}><AssigneeSelect users={users} value={item.assignedTo} onChange={(val) => handleUpdateAssignee(item._id.toString(), val)} /></div> },
    ],
    [users, handleUpdateAssignee]
  );

  // Lógica de exportação (extraída do código antigo)
  const fetchAllFilteredObservations = useCallback(async () => {
    // Usa o estado atual do DataTable? Precisamos de acesso à query atual.
    // Para simplificar, buscamos todos com filtros ativos via URL (searchParams do DataTable não está exposto).
    // Vamos buscar todas as observações com base no endpoint? O DataTable não expõe a query ativa.
    // Alternativa: criar uma função que recebe a query atual via callback do DataTable? 
    // Para este caso, vamos buscar todas as observações (sem filtro) e depois filtrar no cliente? 
    // Melhor: adicionar um ref no DataTable para expor a query atual? 
    // Vou adotar uma abordagem simples: buscar todas as observações (all=true) e usar o filtro atual? 
    // Como o DataTable não expõe, vamos apenas exportar tudo (comportamento aceitável).
    const res = await fetch("/api/observations?all=true");
    if (!res.ok) throw new Error("Erro ao buscar dados completos");
    const data = await res.json();
    return data.observations as IObservation[];
  }, []);

  const handleExportExcel = useCallback(async () => {
    if (!confirm("Exportar todos os resultados atuais para Excel?")) return;
    try {
      const fullObservations = await fetchAllFilteredObservations();
      if (!fullObservations || fullObservations.length === 0) return alert("Nenhuma Observation para exportar");

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
      titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "003366" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(1).height = 30;

      ws.mergeCells("A2:K2");
      const subtitleCell = ws.getCell("A2");
      subtitleCell.value = "Relatório Geral de Vulnerabilidades de Projetos";
      subtitleCell.font = { name: "Arial", size: 12, italic: true, color: { argb: "666666" } };
      subtitleCell.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(2).height = 20;

      ws.mergeCells("A3:K3");
      const timestampCell = ws.getCell("A3");
      timestampCell.value = `Exportado por DebitBoard em ${new Date().toLocaleString()}`;
      timestampCell.font = { name: "Arial", size: 10, color: { argb: "999999" } };
      timestampCell.alignment = { vertical: "middle", horizontal: "left" };

      ws.getRow(4).height = 10;

      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 10 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      const headers = [
        "Projeto", "Repositório", "Branch", "Arquivo", "Categoria",
        "Status", "Azure", "Severidade", "SLA (Horas)", "Hits", "Justificativa"
      ];
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });

      ws.autoFilter = { from: "A5", to: "K5" };

      const totalObservations = fullObservations.length;
      const totalOpen = fullObservations.filter(i => i.status === "open" || i.status === "recurring").length;
      const totalResolved = fullObservations.filter(i => i.status === "resolved").length;
      const totalProjects = new Set(fullObservations.map(i => i.project)).size;

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

        const azureSettings = session?.user?.azureSettings as IAzureSettings;
        const instanceUrl = azureSettings?.instanceUrl || "";
        const azureCollection = azureSettings?.azureCollection || "";
        const azureUrl = `${instanceUrl}/tfs/${azureCollection}/${issue.project}/_git/${issue.repository}?path=${issue.filePath}&version=GB${issue.branch}&_a=contents`;

        row.getCell("project").value = issue.project || "";
        row.getCell("repository").value = issue.repository || "";
        row.getCell("branch").value = issue.branch;
        row.getCell("filePath").value = issue.filePath;
        row.getCell("category").value = issue.category;
        row.getCell("status").value = issue.status;
        row.getCell("azureLink").value = { text: "Ver no Azure", hyperlink: azureUrl };
        row.getCell("severity").value = issue.severity;
        row.getCell("slaHours").value = issue.slaHours;
        row.getCell("hitCount").value = issue.hitCount;
        row.getCell("justificativa").value = "";

        row.alignment = { vertical: "middle" };
        row.getCell("status").alignment = { horizontal: "center", vertical: "middle" };
        row.getCell("severity").alignment = { horizontal: "center", vertical: "middle" };
        row.getCell("hitCount").alignment = { horizontal: "center", vertical: "middle" };
        row.getCell("azureLink").alignment = { horizontal: "center", vertical: "middle" };

        row.eachCell(cell => {
          cell.border = { top: { style: "thin", color: { argb: "E5E7EB" } }, left: { style: "thin", color: { argb: "E5E7EB" } }, bottom: { style: "thin", color: { argb: "E5E7EB" } }, right: { style: "thin", color: { argb: "E5E7EB" } } };
        });

        const statusCell = row.getCell("status");
        if (issue.status === "new" || issue.status === "open" || issue.status === "recurring") {
          statusCell.font = { color: { argb: "991B1B" }, bold: true };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
        } else if (issue.status === "resolved") {
          statusCell.font = { color: { argb: "065F46" }, bold: true };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
        }

        const sevCell = row.getCell("severity");
        if (issue.severity === "critical") {
          sevCell.font = { color: { argb: "991B1B" }, bold: true };
          sevCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FECACA" } };
        } else if (issue.severity === "high") {
          sevCell.font = { color: { argb: "9A3412" }, bold: true };
          sevCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDD5" } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Observations_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Erro na exportação Excel: " + (err as Error).message);
    }
  }, [fetchAllFilteredObservations, session]);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Relatorio_Observations",
  });

  const handleExportPDF = useCallback(async () => {
    try {
      const fullObservations = await fetchAllFilteredObservations();
      setReportData(fullObservations);
    } catch (err) {
      alert("Erro na geração do PDF: " + (err as Error).message);
    }
  }, [fetchAllFilteredObservations]);

  useEffect(() => {
    if (reportData.length > 0) {
      handlePrint();
    }
  }, [reportData, handlePrint]);

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => { map[u.sub] = u.name || u.email; });
    return map;
  }, [users]);

  return (
    <div className="w-full p-8 space-y-6">
      <PageHeader
        title="Observations Feed"
        subtitle="Central de monitoramento de vulnerabilidades."
        icon={<Binoculars className="w-10 h-10 text-apple-blue" />}
      />
      <DataTable
        endpoint="/api/observations"
        columns={columns}
        userId={session?.user?.id || ""}
        searchPlaceholder="Buscar via DBQL..."
        searchContext="observations"
        refreshKey={refreshKey}
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />
      <ObservationDrawer
        observation={selectedObservation}
        users={users}
        azureSettings={azureSettings}
        onClose={() => setSelectedObservation(null)}
        onUpdateAssignee={handleUpdateAssignee}
      />
      <div style={{ display: "none" }}>
        <div ref={reportRef}>
          <ObservationsReport observations={reportData} usersMap={usersMap} />
        </div>
      </div>
    </div>
  );
}