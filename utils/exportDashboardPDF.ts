import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface DashboardPDFData {
  teamName: string;
  generatedAt: Date;
  teamStats: any;
  projectStats: any;
  projects: any[]; // array de projetos com nome, severityCounts, description, lastScan
  categoryDetails?: any;
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
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 20, "F");

  doc.setFillColor(59, 130, 246);
  doc.circle(15, 10, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("D", 15, 13, { align: "center" });

  doc.setFontSize(14);
  doc.text("Debit Board", 25, 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Relatório gerado em: ${data.generatedAt.toLocaleString("pt-BR")}`,
    pageWidth - margin,
    10,
    { align: "right" }
  );

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text(`Time: ${data.teamName || "Global"}`, 25, 15);

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
  doc.roundedRect(margin + 2 * (cardWidth + 5), y, cardWidth, cardHeight, 2, 2, "F");
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
  if (data.teamStats.categoryTotals) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Distribuição por Categoria (Individual)", margin, y);

    y += 5;
    const categories = Object.entries(data.teamStats.categoryTotals);
    if (categories.length > 0) {
      const totalCat = categories.reduce((sum, [, val]) => sum + Number(val), 0);
      const barWidth = pageWidth - margin * 2;
      const barHeight = 8;

      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, "F");

      const colors = [
        '#911eb4', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
        '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#e6194B',
        '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
        '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939',
        '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39',
        '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b'
        ];
      let currentX = margin;
      categories.forEach(([cat, value], i) => {
        const segWidth = (value / totalCat) * barWidth;
        doc.setFillColor(colors[i % colors.length]);
        doc.rect(currentX, y, segWidth, barHeight, "F");
        currentX += segWidth;
      });

      // Legendas em 2 colunas com largura fixa (sem sobreposição)
      y += barHeight + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const legendColWidth = (pageWidth - margin * 2) / 2;
      
      categories.forEach(([cat, value], i) => {
        const colIndex = i % 2;
        const rowIndex = Math.floor(i / 2);
        const startX = margin + colIndex * legendColWidth;
        const startY = y + rowIndex * 6;

        doc.setFillColor(colors[i % colors.length]);
        doc.circle(startX + 2, startY + 1, 1.5, "F");
        doc.setTextColor(100, 116, 139);
        doc.text(`${cat}: ${value}`, startX + 5, startY + 3);
      });
      y += Math.ceil(categories.length / 2) * 6 + 8;
    }
  }

  // ===================== DISTRIBUIÇÃO (Grupo) =====================
  if (data.teamStats.categoryGroupTotals) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Distribuição por Categoria (Agrupado)", margin, y);

    y += 5;
    const categories = Object.entries(data.teamStats.categoryGroupTotals);
    if (categories.length > 0) {
      const totalCat = categories.reduce((sum, [, val]) => sum + Number(val), 0)
      const barWidth = pageWidth - margin * 2;
      const barHeight = 8;

      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin, y, barWidth, barHeight, 2, 2, "F");

      const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#911eb4", "#3cb44b", "#ffe119", "#4363d8", "#f58231"];
      let currentX = margin;
      categories.forEach(([cat, value], i) => {
        const segWidth = (value / totalCat) * barWidth;
        doc.setFillColor(colors[i % colors.length]);
        doc.rect(currentX, y, segWidth, barHeight, "F");
        currentX += segWidth;
      });

      // Legendas em 2 colunas com largura fixa (sem sobreposição)
      y += barHeight + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const legendColWidth = (pageWidth - margin * 2) / 2;
      
      categories.forEach(([cat, value], i) => {
        const colIndex = i % 2;
        const rowIndex = Math.floor(i / 2);
        const startX = margin + colIndex * legendColWidth;
        const startY = y + rowIndex * 6;

        doc.setFillColor(colors[i % colors.length]);
        doc.circle(startX + 2, startY + 1, 1.5, "F");
        doc.setTextColor(100, 116, 139);
        doc.text(`${cat}: ${value}`, startX + 5, startY + 3);
      });
      y += Math.ceil(categories.length / 2) * 6 + 8;
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

    const tableData = data.projects.map((project: any) => {
    const description = project.description || "";
    const truncatedDescription = description.length > 80
        ? description.slice(0, 80) + " (...)"
        : description;

        return [
            project.name || "",
            `${project.severity?.critical || 0} / ${project.severity?.high || 0} / ${project.severity?.medium || 0} / ${project.severity?.low || 0}`,
            truncatedDescription,
            project.lastScan || "",
        ];
    });

    // Largura total da tabela (página A4 landscape - margens)
    const tableWidth = pageWidth - margin * 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Projeto", "Severidade (C/A/M/B)", "Descrição", "Último Scan"]],
      body: tableData,
      theme: "grid",
      tableWidth: tableWidth, // 🔥 Força a tabela a ocupar toda a largura
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { textColor: [51, 65, 85], fontSize: 8 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      styles: { overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: tableWidth * 0.20 }, // Projeto
        1: { cellWidth: tableWidth * 0.15, halign: "center" }, // Severidade
        2: { cellWidth: tableWidth * 0.45, overflow: 'ellipsize' }, // Descrição
        3: { cellWidth: tableWidth * 0.20, halign: "center" }, // Último Scan
      },
    });
  }

  // ===================== RODAPÉ =====================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(30, 41, 59);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("© 2026 Debit Board - Confidencial", margin, pageHeight - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  doc.save("DebitBoard_Dashboard_Report.pdf");
}