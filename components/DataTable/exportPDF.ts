import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { extractText, generateHeader, generateFooter } from "./pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "./logo";

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
  logoBase64?: string;
}

export function exportTableToPDF({
  title,
  subtitle,
  columns,
  data,
  filename,
  orientation = "portrait",
  logoBase64 = DEBIT_BOARD_LOGO_BASE64, // Fallback automático para a logo padrão
}: ExportOptions) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  // Cabeçalho compartilhado com suporte à logo e cores padronizadas
  generateHeader(doc, { title, subtitle, logoBase64 });

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
    startY: 28, // Ajustado para dar espaço ao banner superior
    margin: { left: margin, right: margin },
    head: [head],
    body,
    theme: "grid",
    tableWidth,
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { textColor: [51, 65, 85], fontSize: 8 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    styles: { overflow: "linebreak" },
  });

  // Rodapé compartilhado
  generateFooter(doc);

  doc.save(filename || `${title}.pdf`);
}