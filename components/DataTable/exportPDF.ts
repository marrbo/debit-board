// components/DataTable/exportPDF.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  key: string;
  label: string;
  render?: (item: any) => any;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename?: string;
}

export function exportTableToPDF({
  title,
  subtitle,
  columns,
  data,
  filename,
}: ExportOptions) {
  const doc = new jsPDF({
    orientation: "portrait",
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
  doc.text(title, 25, 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    pageWidth - margin,
    10,
    { align: "right" }
  );

  if (subtitle) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text(subtitle, 25, 15);
  }

  // ===================== TABELA =====================
  const head = columns.map((col) => col.label);
  const body = data.map((item) =>
    columns.map((col) => {
      const value = col.render ? col.render(item) : item[col.key];
      return String(value ?? "");
    })
  );

  const tableWidth = pageWidth - margin * 2;

  autoTable(doc, {
    startY: 30,
    margin: { left: margin, right: margin },
    head: [head],
    body,
    theme: "grid",
    tableWidth,
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { textColor: [51, 65, 85], fontSize: 8 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    styles: { overflow: 'linebreak' },
  });

  // ===================== RODAPÉ =====================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(30, 41, 59);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("© 2026 Debit Board - Confidencial", margin, pageHeight - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  }

  doc.save(filename || `${title}.pdf`);
}