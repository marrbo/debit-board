// components/DataTable/exportExcel.ts
import ExcelJS from "exceljs";
import { extractText } from "./pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "./logo";

export interface ExportExcelColumn {
  key: string;
  label: string;
  width?: string;
  render?: (item: any) => any;
  /**
   * Renderizador por célula no Excel. Recebe o `Cell` do ExcelJS já
   * posicionado e pode escrever rich text, aplicar fill, borders, etc.
   * Quando presente, o valor padrão (extractText) é ignorado.
   */
  excelCellRenderer?: (
    cell: ExcelJS.Cell,
    item: any,
    extraData?: Record<string, any>,
  ) => void;
}

export interface ExportExcelOptions {
  title: string;
  subtitle?: string;
  columns: ExportExcelColumn[];
  data: any[];
  filename?: string;
  logoBase64?: string;
  /** Orientação da página. Default: "landscape" (A4 horizontal). */
  orientation?: "portrait" | "landscape";
  /** Repassado aos `excelCellRenderer` — mesma referência do DataTable. */
  extraData?: Record<string, any>;
}

/**
 * Garante que `cell.value` sempre receba string — evita XML inválido
 * quando o dado é `undefined`/`null`.
 */
function safeCellValue(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Caracteres proibidos pelo Excel em nomes de aba: `\ / ? * [ ] :` */
function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[\\/?*[\]:]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 31) || "Relatório";
}

// ============================================================
// Configuração A4 (em polegadas — ExcelJS usa inches)
// ============================================================
const A4_MARGINS = {
  left: 0.3,
  right: 0.3,
  top: 0.5,
  bottom: 0.5,
  header: 0.2,
  footer: 0.2,
};

export async function exportTableToExcel({
  title,
  subtitle,
  columns,
  data,
  filename,
  logoBase64 = DEBIT_BOARD_LOGO_BASE64,
  orientation = "landscape",
  extraData,
}: ExportExcelOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Debit Board";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(safeSheetName(title));

  const totalCols = columns.length;

  // ============================================================
  // Configuração de página A4 + orientação
  // ============================================================
  worksheet.pageSetup = {
    paperSize: 9, // 9 = A4
    orientation,
    fitToPage: true,
    fitToWidth: 1, // encaixa todas as colunas em 1 página de largura
    fitToHeight: 0, // sem limite vertical (paginação automática)
    horizontalCentered: true,
    printTitlesRow: "5:5", // repete cabeçalho em toda página
    margins: A4_MARGINS,
  };
  worksheet.properties.defaultRowHeight = 15;

  // ============================================================
  // 1. Banner de cabeçalho (linhas 1-3)
  // ============================================================
  for (let r = 1; r <= 3; r++) {
    const row = worksheet.getRow(r);
    row.height = r === 1 ? 26 : r === 2 ? 18 : 8;
    for (let c = 1; c <= totalCols; c++) {
      row.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0056B3" },
      };
    }
  }

  // ============================================================
  // 2. Logo — largura proporcional para não esticar
  // ============================================================
  // Fixa a largura da coluna A para acomodar a logo (aspect ~1.4:1).
  // Sem isso, a coluna herda a largura dos dados e a imagem estica.
  worksheet.getColumn(1).width = 14;

  if (logoBase64) {
    const cleanBase64 = logoBase64.replace(
      /^data:image\/(png|jpeg|jpg);base64,/,
      "",
    );
    const imageId = workbook.addImage({
      base64: cleanBase64,
      extension: "png",
    });
    // `tl` + `br` é a forma canônica OOXML — evita corrupção no 3.x
    worksheet.addImage(imageId, {
      tl: { col: 0.05, row: 0.05 },
      br: { col: 0.95, row: 2.95 },
      editAs: "oneCell",
    } as any);
  }

  // ============================================================
  // 3. Título e subtítulo (coluna B em diante)
  // ============================================================
  const textCol = 2;

  const titleCell = worksheet.getRow(1).getCell(textCol);
  titleCell.value = safeCellValue(title);
  titleCell.font = {
    name: "Arial",
    size: 13,
    bold: true,
    color: { argb: "FFF1F5F9" },
  };
  titleCell.alignment = { vertical: "bottom", horizontal: "left" };

  const timestamp = new Date().toLocaleString("pt-BR");
  const subtitleText = `${subtitle || "Debit Board - Relatório de Dados"} | Gerado em: ${timestamp}`;

  const subtitleCell = worksheet.getRow(2).getCell(textCol);
  subtitleCell.value = safeCellValue(subtitleText);
  subtitleCell.font = {
    name: "Arial",
    size: 9,
    italic: true,
    color: { argb: "FFE2E8F0" },
  };
  subtitleCell.alignment = { vertical: "top", horizontal: "left" };

  // Espaçador
  worksheet.getRow(4).height = 8;

  // ============================================================
  // 4. Cabeçalho das colunas (linha 5)
  // ============================================================
  const headerRowIndex = 5;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = columns.map((col) => safeCellValue(col.label));
  headerRow.height = 22;

  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // slate-800 como no PDF
    };
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
    };
  }

  // ============================================================
  // 5. Linhas de dados
  // ============================================================
  data.forEach((item, rowIndex) => {
    const rowData = columns.map((col) => {
      // Se tem `excelCellRenderer`, deixa vazio (o renderer preenche)
      if (col.excelCellRenderer) return "";
      const rawValue = col.render ? col.render(item) : item[col.key];
      return safeCellValue(extractText(rawValue));
    });

    const row = worksheet.addRow(rowData);
    row.height = 22; // altura uniforme com o PDF
    const isAlternate = rowIndex % 2 === 1;

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      const col = columns[c - 1];

      // Zebra + borders + fonte padrão
      cell.font = {
        name: "Arial",
        size: 9,
        color: { argb: "FF334155" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };

      if (isAlternate) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Renderer customizado (sobrescreve valor + estilos se quiser)
      if (col.excelCellRenderer) {
        col.excelCellRenderer(cell, item, extraData);
      }
    }
  });

  // ============================================================
  // 6. Congelar topo + autofilter
  // ============================================================
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: headerRowIndex }];

  if (data.length > 0 && totalCols > 0) {
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: totalCols },
    };
  }

  // ============================================================
  // 7. Larguras — respeitando o fit-to-page A4
  // ============================================================
  // A4 landscape ~ 297mm. Com fitToWidth=1, o Excel comprime se
  // necessário. Definimos larguras proporcionais ao conteúdo mas
  // com um teto por coluna (evita "Projeto" com 50 chars tomar tudo).
  columns.forEach((col, index) => {
    const colNum = index + 1;
    if (colNum === 1) return; // já ajustada para a logo

    let maxLen = col.label ? col.label.length : 10;
    data.forEach((item) => {
      if (col.excelCellRenderer) return;
      const rawValue = col.render ? col.render(item) : item[col.key];
      const text = safeCellValue(extractText(rawValue));
      if (text) maxLen = Math.max(maxLen, text.length);
    });

    let customWidth: number | undefined;
    if (col.width) {
      const parsedPx = parseInt(col.width, 10);
      if (!isNaN(parsedPx)) customWidth = Math.round(parsedPx / 8);
    }

    worksheet.getColumn(colNum).width =
      customWidth || Math.min(Math.max(maxLen + 3, 12), 40);
  });

  // ============================================================
  // 8. Rodapé (números de página)
  // ============================================================
  worksheet.headerFooter.oddFooter =
    "&L© 2026 Debit Board - Confidencial&RPágina &P de &N";

  // ============================================================
  // 9. Download
  // ============================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `${title}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
