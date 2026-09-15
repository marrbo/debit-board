// components/DataTable/exportExcel.ts

import ExcelJS from "exceljs";
import { extractText } from "./pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "./logo";

export interface ExportExcelColumn {
  key: string;
  label: string;
  width?: string;
  render?: (item: any) => any;
}

export interface ExportExcelOptions {
  title: string;
  subtitle?: string;
  columns: ExportExcelColumn[];
  data: any[];
  filename?: string;
  logoBase64?: string;
}

export async function exportTableToExcel({
  title,
  subtitle,
  columns,
  data,
  filename,
  logoBase64 = DEBIT_BOARD_LOGO_BASE64, // Fallback para a logo nativa
}: ExportExcelOptions) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.slice(0, 30) || "Relatório");

  const totalCols = Math.max(columns.length, 5);

  // 1. Banner Azul de Cabeçalho (Linhas 1 a 3) - --brand-default (#0056b3)
  for (let r = 1; r <= 3; r++) {
    const row = worksheet.getRow(r);
    row.height = r === 1 ? 26 : r === 2 ? 18 : 8;

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0056B3" }, // #0056b3
      };
    }
  }

  // 2. Renderização da Logo no Canto Superior Esquerdo
  if (logoBase64) {
    // Tratamento para garantir que o ExcelJS receba o base64 puro
    const cleanBase64 = logoBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const imageId = workbook.addImage({
      base64: cleanBase64,
      extension: "png",
    });

    // Posiciona a logo na linha 1, coluna 1 com dimensões adequadas
    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 58, height: 70 },
    });
  }

  // Offset para alinhar o texto após o ícone da logo
  const textCol = 2;

  // 3. Título e Subtítulo em Branco (--text-body dark: #f1f5f9)
  const titleCell = worksheet.getRow(1).getCell(textCol);
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFF1F5F9" } };
  titleCell.alignment = { vertical: "bottom", horizontal: "left" };

  const timestamp = new Date().toLocaleString("pt-BR");
  const subtitleText = `${subtitle || "Debit Board - Relatório de Dados"} | Gerado em: ${timestamp}`;
  const subtitleCell = worksheet.getRow(2).getCell(textCol);
  subtitleCell.value = subtitleText;
  subtitleCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FFE2E8F0" } };
  subtitleCell.alignment = { vertical: "top", horizontal: "left" };

  // Espaçador (Linha 4)
  worksheet.getRow(4).height = 12;

  // 4. Cabeçalho das Colunas da Tabela (Linha 5)
  const headerRowIndex = 5;
  const headers = columns.map((col) => col.label);
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Fundo escuro das colunas [30, 41, 59]
    };
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // 5. Linhas de Dados com Alternância Zebra
  data.forEach((item, rowIndex) => {
    const rowData = columns.map((col) => {
      const rawValue = col.render ? col.render(item) : item[col.key];
      return extractText(rawValue);
    });

    const row = worksheet.addRow(rowData);
    const isAlternate = rowIndex % 2 === 1;

    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 9, color: { argb: "FF334155" } };
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
    });
  });

  // Congela linhas superiores (Manter Banner + Cabeçalho das Colunas fixos no scroll)
  worksheet.views = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowIndex,
    },
  ];

  // Ativa o filtro nativo do Excel na linha de colunas
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  // Ajuste proporcional das colunas
  columns.forEach((col, index) => {
    const colNum = index + 1;
    let maxLen = col.label ? col.label.length : 10;

    data.forEach((item) => {
      const rawValue = col.render ? col.render(item) : item[col.key];
      const text = extractText(rawValue);
      if (text) {
        maxLen = Math.max(maxLen, String(text).length);
      }
    });

    let customWidth: number | undefined;
    if (col.width) {
      const parsedPx = parseInt(col.width, 10);
      if (!isNaN(parsedPx)) customWidth = Math.round(parsedPx / 8);
    }

    worksheet.getColumn(colNum).width = customWidth || Math.min(Math.max(maxLen + 4, 14), 50);
  });

  // Download no navegador
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