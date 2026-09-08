// components/DataTable/exportPDF.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { extractText, generateHeader, generateFooter } from "./pdfShared";

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
  orientation?: "portrait" | "landscape";
}

export function exportTableToPDF({
  title,
  subtitle,
  columns,
  data,
  filename,
  orientation = "portrait",
}: ExportOptions) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  // Cabeçalho compartilhado
  generateHeader(doc, { title, subtitle });

  // Tabela
  const head = columns.map((col) => col.label);
  const body = data.map((item) =>
    columns.map((col) => {
      const value = col.render ? col.render(item) : item[col.key];
      return extractText(value);
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

  // Rodapé compartilhado
  generateFooter(doc);

  doc.save(filename || `${title}.pdf`);
}