// lib/pdf/shared.ts
import { jsPDF } from "jspdf";
import React from "react";

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
// Desenho do ícone ShieldKeyhole (usado no cabeçalho)
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
// Cabeçalho padrão para todos os relatórios
// ============================================================
export interface PDFHeaderOptions {
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  showLogo?: boolean;
  logoColor?: string;
}

export function generateHeader(doc: jsPDF, options: PDFHeaderOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  const headerHeight = 20;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  if (options.showLogo !== false) {
    drawShieldKeyhole(doc, 9, 4, 12, options.logoColor || "#FFFFFF");
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, 25, 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em: ${(options.generatedAt || new Date()).toLocaleString("pt-BR")}`,
    pageWidth - margin,
    10,
    { align: "right" }
  );

  if (options.subtitle) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text(options.subtitle, 25, 15);
  }
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