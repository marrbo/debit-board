// lib/pdf/shared.ts
import type { jsPDF } from "jspdf";
import React from "react";
import { DEBIT_BOARD_LOGO_BASE64 } from "../../components/DataTable/logo";

// ============================================================
// Extração de texto de elementos React ou valores primitivos
// ============================================================
export function extractText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (React.isValidElement(value)) {
    const children = (value.props as any)?.children;
    if (children !== undefined && children !== null) {
      if (Array.isArray(children)) {
        return children.map((child) => extractText(child)).join(" ");
      }
      return extractText(children);
    }
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

// lib/pdf/shared.ts (adicione ao final do arquivo)

// ============================================================
// Shield preenchido (usado na coluna Severidade do PDF)
// ============================================================
/**
 * Desenha um shield preenchido no doc, dado o canto superior esquerdo.
 * Mesma técnica do `drawShieldKeyhole` (segmentos de linha + close),
 * mas com preenchimento sólido em vez de contorno.
 */
export function drawShieldShape(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
) {
  // Aproximação do path SVG:
  // M12 2 L4 5 v6 c0 5.2 3.4 8.7 8 10 c4.6 -1.3 8 -4.8 8 -10 V5 l-8 -3 z
  const pts: [number, number][] = [
    [12, 2],
    [4, 5],
    [4, 11],
    [4.5, 14],
    [6, 17],
    [8, 19.5],
    [10, 20.8],
    [12, 21],
    [14, 20.8],
    [16, 19.5],
    [18, 17],
    [19.5, 14],
    [20, 11],
    [20, 5],
  ];
  const minX = 4;
  const maxX = 20;
  const minY = 2;
  const maxY = 21;
  const sx = w / (maxX - minX);
  const sy = h / (maxY - minY);

  const abs = pts.map(
    ([px, py]) =>
      [x + (px - minX) * sx, y + (py - minY) * sy] as [number, number],
  );

  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // Deltas relativos a partir do primeiro ponto
  const deltas: [number, number][] = [];
  for (let i = 1; i < abs.length; i++) {
    deltas.push([abs[i][0] - abs[i - 1][0], abs[i][1] - abs[i - 1][1]]);
  }

  // `closed: true` fecha o path com uma linha implícita → shape completo
  doc.lines(deltas, abs[0][0], abs[0][1], [1, 1], "F", true);
}

// ============================================================
// Severidade — shields C/H/M/L com contagem abaixo
// ============================================================
export interface SeverityCounts {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

/**
 * Renderiza os 4 shields (C/H/M/L) com o número da contagem abaixo,
 * replicando o layout da coluna Severidade da tabela HTML.
 *
 * Recebe as coordenadas da célula do autoTable (x, y, w, h) e se
 * auto-centraliza horizontal e verticalmente.
 */
export function drawSeverityShields(
  doc: jsPDF,
  x: number,
  y: number,
  severity: SeverityCounts,
  cellWidth: number,
  cellHeight: number,
) {
  const items = [
    {
      letter: "C",
      count: severity.critical || 0,
      rgb: [239, 68, 68] as [number, number, number],
    },
    {
      letter: "H",
      count: severity.high || 0,
      rgb: [249, 115, 22] as [number, number, number],
    },
    {
      letter: "M",
      count: severity.medium || 0,
      rgb: [234, 179, 8] as [number, number, number],
    },
    {
      letter: "L",
      count: severity.low || 0,
      rgb: [34, 197, 94] as [number, number, number],
    },
  ];

  const shieldW = 4.5; // mm
  const shieldH = 5.5; // mm
  const gap = 2.0; // mm
  const countAreaH = 3.0; // mm — espaço reservado para o número abaixo
  const groupH = shieldH + countAreaH;
  const totalW = items.length * shieldW + (items.length - 1) * gap;

  const startX = x + (cellWidth - totalW) / 2;
  const startY = y + (cellHeight - groupH) / 2;

  items.forEach((item, i) => {
    const cx = startX + i * (shieldW + gap);

    drawShieldShape(doc, cx, startY, shieldW, shieldH, item.rgb);

    // Letra dentro do shield
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(item.letter, cx + shieldW / 2, startY + shieldH * 0.55, {
      align: "center",
    });

    // Contagem abaixo do shield
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(String(item.count), cx + shieldW / 2, startY + shieldH + 2.5, {
      align: "center",
    });
  });
}

// ============================================================
// Desenho do ícone ShieldKeyhole em vetor (Fallback visual)
// ============================================================
export function drawShieldKeyhole(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const s = size / 24;
  doc.setDrawColor(color);
  doc.setLineWidth(1.5 * s);

  const points: [number, number][] = [
    [4, 6],
    [6, 5],
    [8, 4.5],
    [10, 3.8],
    [12, 3],
    [14, 3.8],
    [16, 4.5],
    [18, 5],
    [20, 6],
    [20, 13],
    [18, 16],
    [16, 18],
    [14, 19.5],
    [12, 20.5],
    [10, 19.5],
    [8, 18],
    [6, 16],
    [4, 13],
  ];

  const absPoints = points.map(
    ([px, py]) => [x + px * s, y + py * s] as [number, number],
  );

  for (let i = 0; i < absPoints.length - 1; i++) {
    const [x1, y1] = absPoints[i];
    const [x2, y2] = absPoints[i + 1];
    doc.line(x1, y1, x2, y2);
  }

  const [lastX, lastY] = absPoints[absPoints.length - 1];
  const [firstX, firstY] = absPoints[0];
  doc.line(lastX, lastY, firstX, firstY);

  doc.circle(x + 12 * s, y + 11 * s, 2 * s, "S");
  doc.line(x + 12 * s, y + 13 * s, x + 12 * s, y + 15 * s);
}

// ============================================================
// Cabeçalho padrão para todos os relatórios PDF
// ============================================================
export interface PDFHeaderOptions {
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  showLogo?: boolean;
  logoBase64?: string;
  logoColor?: string;
}

export function generateHeader(doc: jsPDF, options: PDFHeaderOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 22;

  // Banner superior azul --brand-default: #0056b3 -> RGB (0, 86, 179)
  doc.setFillColor(0, 86, 179);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Renderização da Logo (Base64 PNG ou Vetor ShieldKeyhole)
  const activeLogo = options.logoBase64 || DEBIT_BOARD_LOGO_BASE64;

  if (options.showLogo !== false) {
    if (activeLogo) {
      const cleanBase64 = activeLogo.replace(
        /^data:image\/(png|jpeg|jpg);base64,/,
        "",
      );
      doc.addImage(cleanBase64, "PNG", 0, 0, 18, 22);
    } else {
      drawShieldKeyhole(doc, 0, 0, 20, options.logoColor || "#FFFFFF");
    }
  }

  const textX = options.showLogo !== false ? 25 : 8;

  // Título principal (--text-body dark: #f1f5f9 -> RGB 241, 245, 249)
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, textX, 10);

  // Subtítulo e timestamp (--text-muted: #e2e8f0 -> RGB 226, 232, 240)
  const timestamp = (options.generatedAt || new Date()).toLocaleString("pt-BR");
  const subtitleText = `${options.subtitle || "Debit Board - Relatório de Dados"} | Gerado em: ${timestamp}`;

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(subtitleText, textX, 16);
}

// ============================================================
// Rodapé padrão para todos os relatórios
// ============================================================
export function generateFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(0, 86, 179);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("© 2026 Debit Board - Confidencial", margin, pageHeight - 5);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 5,
      {
        align: "right",
      },
    );
  }
}
