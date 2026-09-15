// lib/pdf/shared.ts
import type { jsPDF } from "jspdf";
import React from "react";
import { DEBIT_BOARD_LOGO_BASE64 } from "../../components/DataTable/logo";

// ============================================================
// Extração de texto de elementos React ou valores primitivos
// ============================================================
export function extractText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
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

// ============================================================
// Desenho do ícone ShieldKeyhole em vetor (Fallback visual)
// ============================================================
export function drawShieldKeyhole(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const s = size / 24;
  doc.setDrawColor(color);
  doc.setLineWidth(1.5 * s);

  const points: [number, number][] = [
    [4, 6], [6, 5], [8, 4.5], [10, 3.8], [12, 3],
    [14, 3.8], [16, 4.5], [18, 5], [20, 6],
    [20, 13], [18, 16], [16, 18], [14, 19.5],
    [12, 20.5], [10, 19.5], [8, 18], [6, 16], [4, 13]
  ];

  const absPoints = points.map(([px, py]) => [x + px * s, y + py * s] as [number, number]);

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
      const cleanBase64 = activeLogo.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      doc.addImage(cleanBase64, "PNG", 0, 0, 18, 22);
    } else {
      drawShieldKeyhole(doc, 0, 0, 20, options.logoColor || "#FFFFFF");
    }
  }

  const textX = options.showLogo !== false ? 40 : 8;

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
    doc.setFillColor(30, 41, 59);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("© 2026 Debit Board - Confidencial", margin, pageHeight - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 5, {
      align: "right",
    });
  }
}