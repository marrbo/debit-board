// components/DataTable/exportPDF.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { extractText, generateHeader, generateFooter } from "./pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "./logo";

export interface ExportColumn {
  key: string;
  label: string;
  render?: (item: any) => any;
  /**
   * Renderizador vetorial por célula. Quando presente, o conteúdo da
   * coluna é desenhado manualmente em vez de texto.
   *
   * Recebe:
   *  - `doc`: jsPDF
   *  - `cell`: dados da célula do autoTable (`cell.x/y/width/height`)
   *  - `item`: linha atual
   *  - `extraData`: mesmo `extraData` passado ao DataTable
   */
  pdfCellRenderer?: (
    doc: jsPDF,
    cell: any,
    item: any,
    extraData?: Record<string, any>,
  ) => void;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  filename?: string;
  orientation?: "portrait" | "landscape";
  logoBase64?: string;
  /** Repassado aos `pdfCellRenderer` — mesma referência do DataTable */
  extraData?: Record<string, any>;
}

export function exportTableToPDF({
  title,
  subtitle,
  columns,
  data,
  filename,
  orientation = "portrait",
  logoBase64 = DEBIT_BOARD_LOGO_BASE64,
  extraData,
}: ExportOptions) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  generateHeader(doc, { title, subtitle, logoBase64 });

  const head = columns.map((col) => col.label);

  // Células com `pdfCellRenderer` produzem string vazia — serão desenhadas
  // no `didDrawCell`. As demais seguem o fluxo normal de extractText.
  const body = data.map((item) =>
    columns.map((col) => {
      if (col.pdfCellRenderer) return "";
      const value = col.render ? col.render(item) : item[col.key];
      return extractText(value);
    }),
  );

  const tableWidth = pageWidth - margin * 2;

  autoTable(doc, {
    startY: 28,
    margin: { left: margin, right: margin },
    head: [head],
    body,
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
      // Garante altura mínima para acomodar os shields (~8.5mm + padding)
      minCellHeight: 14,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    styles: { overflow: "linebreak" },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const col = columns[data.column.index];
      if (!col?.pdfCellRenderer) return;
      const item = data.row.raw as any;
      col.pdfCellRenderer(doc, data, item, extraData);
    },
  });

  generateFooter(doc);

  doc.save(filename || `${title}.pdf`);
}
