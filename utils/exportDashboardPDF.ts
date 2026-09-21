// utils/exportDashboardPDF.ts
import {
  generateFooter,
  generateHeader,
  drawSeverityShields,
} from "@/components/DataTable/pdfShared";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface DashboardPDFData {
  teamName: string;
  generatedAt: Date;
  teamStats: any;
  projectStats: any;
  projects: any[];
  categoryDetails?: any;
}

// Helper para converter entradas de categorias para [string, number][]
function toNumericEntries(obj: Record<string, any>): [string, number][] {
  return Object.entries(obj || {}).map(([key, value]) => [
    key,
    Number(value) || 0,
  ]);
}

export async function exportDashboardPDF(data: DashboardPDFData) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ===================== CABEÇALHO =====================
  generateHeader(doc, {
    title: "Debit Board",
    subtitle: `Time: ${data.teamName || "Global"}`,
    generatedAt: data.generatedAt,
  });

  // ===================== RESUMO EXECUTIVO =====================
  let y = 30;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", margin, y);

  y += 8;

  const cardWidth = (pageWidth - margin * 2 - 10) / 3;
  const cardHeight = 25;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL", margin + 5, y + 7);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(String(data.teamStats.total || 0), margin + 5, y + 18);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + cardWidth + 5, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("SEVERIDADE", margin + cardWidth + 10, y + 7);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let sevText = "";
  const sev = data.teamStats.severityTotals || {};
  if (sev.critical) sevText += `Crítico: ${sev.critical}  `;
  if (sev.high) sevText += `Alto: ${sev.high}  `;
  if (sev.medium) sevText += `Médio: ${sev.medium}  `;
  if (sev.low) sevText += `Baixo: ${sev.low}`;
  doc.text(sevText || "Sem dados", margin + cardWidth + 10, y + 18);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(
    margin + 2 * (cardWidth + 5),
    y,
    cardWidth,
    cardHeight,
    2,
    2,
    "F",
  );
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("STATUS", margin + 2 * (cardWidth + 5) + 5, y + 7);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const status = data.teamStats.statusTotals || {};
  let statusText = "";
  if (status.open) statusText += `Novo: ${status.open}  `;
  if (status.resolved) statusText += `Corrigido: ${status.resolved}  `;
  if (status.recurring) statusText += `Recorrente: ${status.recurring}  `;
  if (status.wont_fix) statusText += `Não Corrigir: ${status.wont_fix}`;
  doc.text(statusText || "Sem dados", margin + 2 * (cardWidth + 5) + 5, y + 18);

  y += cardHeight + 10;

  // ===================== DISTRIBUIÇÃO (Individual) =====================
  const singleCategories = toNumericEntries(data.teamStats.categoryTotals);
  if (singleCategories.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Distribuição por Categoria (Individual)", margin, y);

    y += 5;
    const totalCat = singleCategories.reduce((sum, [, val]) => sum + val, 0);
    if (totalCat > 0) {
      const barWidth = pageWidth - margin * 2;
      const barHeight = 8;

      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, "F");

      const colors = [
        "#911eb4",
        "#3cb44b",
        "#ffe119",
        "#4363d8",
        "#f58231",
        "#42d4f4",
        "#f032e6",
        "#bfef45",
        "#fabed4",
        "#e6194B",
        "#469990",
        "#dcbeff",
        "#9A6324",
        "#fffac8",
        "#800000",
        "#aaffc3",
        "#808000",
        "#ffd8b1",
        "#000075",
        "#a9a9a9",
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#7f7f7f",
        "#bcbd22",
        "#17becf",
        "#393b79",
        "#5254a3",
        "#6b6ecf",
        "#9c9ede",
        "#637939",
        "#8ca252",
        "#b5cf6b",
        "#cedb9c",
        "#8c6d31",
        "#bd9e39",
        "#e7ba52",
        "#e7cb94",
        "#843c39",
        "#ad494a",
        "#d6616b",
      ];
      let currentX = margin;
      singleCategories.forEach(([_, value], i) => {
        const segWidth = (value / totalCat) * barWidth;
        doc.setFillColor(colors[i % colors.length]);
        doc.rect(currentX, y, segWidth, barHeight, "F");
        currentX += segWidth;
      });

      y += barHeight + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const legendColWidth = (pageWidth - margin * 2) / 2;

      singleCategories.forEach(([cat, value], i) => {
        const colIndex = i % 2;
        const rowIndex = Math.floor(i / 2);
        const startX = margin + colIndex * legendColWidth;
        const startY = y + rowIndex * 6;

        doc.setFillColor(colors[i % colors.length]);
        doc.circle(startX + 2, startY + 1, 1.5, "F");
        doc.setTextColor(100, 116, 139);
        doc.text(`${cat}: ${value}`, startX + 5, startY + 3);
      });
      y += Math.ceil(singleCategories.length / 2) * 6 + 8;
    }
  }

  // ===================== DISTRIBUIÇÃO (Agrupado) =====================
  const groupedCategories = toNumericEntries(
    data.teamStats.categoryGroupTotals,
  );
  if (groupedCategories.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Distribuição por Categoria (Agrupado)", margin, y);

    y += 5;
    const totalCat = groupedCategories.reduce((sum, [, val]) => sum + val, 0);
    if (totalCat > 0) {
      const barWidth = pageWidth - margin * 2;
      const barHeight = 8;

      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, "F");

      const colors = [
        "#ef4444",
        "#f59e0b",
        "#3b82f6",
        "#10b981",
        "#911eb4",
        "#3cb44b",
        "#ffe119",
        "#4363d8",
        "#f58231",
      ];
      let currentX = margin;
      groupedCategories.forEach(([_, value], i) => {
        const segWidth = (value / totalCat) * barWidth;
        doc.setFillColor(colors[i % colors.length]);
        doc.rect(currentX, y, segWidth, barHeight, "F");
        currentX += segWidth;
      });

      y += barHeight + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const legendColWidth = (pageWidth - margin * 2) / 2;

      groupedCategories.forEach(([cat, value], i) => {
        const colIndex = i % 2;
        const rowIndex = Math.floor(i / 2);
        const startX = margin + colIndex * legendColWidth;
        const startY = y + rowIndex * 6;

        doc.setFillColor(colors[i % colors.length]);
        doc.circle(startX + 2, startY + 1, 1.5, "F");
        doc.setTextColor(100, 116, 139);
        doc.text(`${cat}: ${value}`, startX + 5, startY + 3);
      });
      y += Math.ceil(groupedCategories.length / 2) * 6 + 8;
    }
  }

  // ===================== TABELA DE PROJETOS =====================
  if (data.projects.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Projetos", margin, y);

    y += 5;

    // A coluna Severidade fica vazia no body — é desenhada via didDrawCell.
    // Mantemos a ordem das colunas para casar com o `didDrawCell`.
    const tableData = data.projects.map((project: any) => {
      const description = project.description || "";
      const truncatedDescription =
        description.length > 80
          ? description.slice(0, 80) + " (...)"
          : description;

      return [
        project.name || "",
        "", // ← Severidade (renderizada por drawSeverityShields)
        truncatedDescription,
        project.lastScan || "",
      ];
    });

    const tableWidth = pageWidth - margin * 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Projeto", "Severidade", "Descrição", "Último Scan"]],
      body: tableData,
      theme: "grid",
      tableWidth,
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: [51, 65, 85],
        fontSize: 8,
        // Espaço para os shields (~9mm) + padding
        minCellHeight: 14,
        valign: "middle",
      },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      styles: { overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: tableWidth * 0.2 },
        1: { cellWidth: tableWidth * 0.16, halign: "center" },
        2: { cellWidth: tableWidth * 0.44, overflow: "ellipsize" },
        3: { cellWidth: tableWidth * 0.2, halign: "center" },
      },
      didDrawCell: (cell) => {
        // Só processa a coluna "Severidade" no corpo da tabela
        if (cell.section !== "body" || cell.column.index !== 1) return;

        const project = data.projects[cell.row.index];
        const severity = project?.severity || {};

        drawSeverityShields(
          doc,
          cell.cell.x,
          cell.cell.y,
          severity,
          cell.cell.width,
          cell.cell.height,
        );
      },
    });
  }

  // ===================== RODAPÉ =====================
  generateFooter(doc);

  doc.save("DebitBoard_Dashboard_Report.pdf");
}
