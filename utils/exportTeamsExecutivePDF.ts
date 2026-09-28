// utils/exportTeamsExecutivePDF.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  generateHeader,
  generateFooter,
} from "@/components/DataTable/pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "@/components/DataTable/logo";
import type { TeamsExecutiveResponse } from "@/types/ITeamsExecutive";

const MARGIN = 10;

/** Converte hex `#rrggbb` → tupla RGB aceita por jsPDF. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

const STYLE = {
  headFill: [30, 41, 59] as [number, number, number],
  bodyText: [51, 65, 85] as [number, number, number],
  mutedText: [100, 116, 139] as [number, number, number],
  headingText: [15, 23, 42] as [number, number, number],
  altRow: [241, 245, 249] as [number, number, number],
};

const SEVERITY_COLOR = {
  critical: hexToRgb("#ef4444"),
  high: hexToRgb("#f97316"),
  medium: hexToRgb("#eab308"),
  low: hexToRgb("#22c55e"),
};

interface ExportInput {
  data: TeamsExecutiveResponse;
  teamLabel: string;
}

/**
 * Exporta o relatório executivo (comparativo entre times) em PDF.
 *
 * Segue o padrão visual dos demais relatórios do Debit Board:
 * cabeçalho azul com logo (`generateHeader`), rodapé institucional
 * (`generateFooter`), tabelas com `jspdf-autotable` e paleta de
 * severidade consistente com a UI.
 *
 * Estrutura:
 *  1. Severidade e status (comparativo entre times visíveis)
 *  2. Distribuição por categoria (rollup)
 *  3. Distribuição por padrão de detecção (rollup)
 *  4. Projetos vinculados (com coluna Time quando `scope: "global"`)
 *
 * @param input - `{ data, teamLabel }` com a resposta da API
 *                `/api/stats/teams-executive` e o rótulo do escopo.
 */
export function exportTeamsExecutivePDF({ data, teamLabel }: ExportInput) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - MARGIN * 2;

  const generatedAt = new Date(data.generatedAt);

  // ===================== CABEÇALHO =====================
  generateHeader(doc, {
    title: "Resumo Executivo",
    subtitle:
      data.scope === "global"
        ? "Comparativo entre times — Global"
        : `Time: ${teamLabel}`,
    generatedAt,
    logoBase64: DEBIT_BOARD_LOGO_BASE64,
  });

  let y = 30;

  // ============================================================
  // 1. Severidade e status — comparativo entre times
  // ============================================================
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...STYLE.headingText);
  doc.text(
    data.scope === "global"
      ? "Severidade e status — Comparativo entre times"
      : `Severidade e status — ${teamLabel}`,
    MARGIN,
    y,
  );
  y += 4;

  const severityHead = [
    "Time",
    "Total",
    "Crítico",
    "Alto",
    "Médio",
    "Baixo",
    "Abertas",
    "Corrigidas",
    "Recorrentes",
    "Não corrigir",
  ];

  const severityBody = data.teams.map((t) => [
    t.teamName,
    String(t.totals.total),
    String(t.totals.critical),
    String(t.totals.high),
    String(t.totals.medium),
    String(t.totals.low),
    String(t.totals.open),
    String(t.totals.resolved),
    String(t.totals.recurring),
    String(t.totals.wontFix),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [severityHead],
    body: severityBody,
    theme: "grid",
    tableWidth,
    headStyles: {
      fillColor: STYLE.headFill,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: {
      textColor: STYLE.bodyText,
      fontSize: 8,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: STYLE.altRow },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold", halign: "left" },
      1: { halign: "right", fontStyle: "bold" },
      2: {
        halign: "right",
        textColor: SEVERITY_COLOR.critical,
        fontStyle: "bold",
      },
      3: { halign: "right", textColor: SEVERITY_COLOR.high, fontStyle: "bold" },
      4: { halign: "right", textColor: SEVERITY_COLOR.medium },
      5: { halign: "right", textColor: SEVERITY_COLOR.low },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });

  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 12;

  // ============================================================
  // 2. Distribuição por categoria
  // ============================================================
  if (data.aggregated.categories.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Distribuição por categoria", MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Categoria", "Observations", "Padrões distintos"]],
      body: data.aggregated.categories.map((c) => [
        c.category,
        String(c.observations),
        String(c.patterns),
      ]),
      theme: "grid",
      tableWidth,
      headStyles: {
        fillColor: STYLE.headFill,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        textColor: STYLE.bodyText,
        fontSize: 8,
        valign: "middle",
      },
      alternateRowStyles: { fillColor: STYLE.altRow },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: "right", fontStyle: "bold" },
        2: { halign: "right", textColor: STYLE.mutedText },
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 12;
  }

  // ============================================================
  // 3. Distribuição por padrão de detecção
  // ============================================================
  if (data.aggregated.patterns.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Distribuição por padrão de detecção", MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Padrão", "Categoria", "Observations"]],
      body: data.aggregated.patterns.map((p) => [
        p.patternName,
        p.category,
        String(p.observations),
      ]),
      theme: "grid",
      tableWidth,
      headStyles: {
        fillColor: STYLE.headFill,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        textColor: STYLE.bodyText,
        fontSize: 8,
        valign: "middle",
      },
      alternateRowStyles: { fillColor: STYLE.altRow },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 90, textColor: STYLE.mutedText },
        2: { halign: "right", fontStyle: "bold" },
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 12;
  }

  // ============================================================
  // 4. Projetos vinculados
  // ============================================================
  if (data.aggregated.projects.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Projetos vinculados", MARGIN, y);
    y += 4;

    const isGlobal = data.scope === "global";
    const projectHead = isGlobal
      ? [["Projeto", "Time", "Total", "Crítico", "Alto", "Médio", "Baixo"]]
      : [["Projeto", "Total", "Crítico", "Alto", "Médio", "Baixo"]];

    const projectBody = data.aggregated.projects.map((p) =>
      isGlobal
        ? [
            p.project,
            p.teamName,
            String(p.total),
            String(p.critical),
            String(p.high),
            String(p.medium),
            String(p.low),
          ]
        : [
            p.project,
            String(p.total),
            String(p.critical),
            String(p.high),
            String(p.medium),
            String(p.low),
          ],
    );

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: projectHead,
      body: projectBody,
      theme: "grid",
      tableWidth,
      headStyles: {
        fillColor: STYLE.headFill,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        textColor: STYLE.bodyText,
        fontSize: 8,
        valign: "middle",
      },
      alternateRowStyles: { fillColor: STYLE.altRow },
      columnStyles: isGlobal
        ? {
            0: { cellWidth: 80 },
            1: { cellWidth: 40, textColor: STYLE.mutedText },
            2: { halign: "right", fontStyle: "bold" },
            3: {
              halign: "right",
              textColor: SEVERITY_COLOR.critical,
              fontStyle: "bold",
            },
            4: {
              halign: "right",
              textColor: SEVERITY_COLOR.high,
              fontStyle: "bold",
            },
            5: { halign: "right", textColor: SEVERITY_COLOR.medium },
            6: { halign: "right", textColor: SEVERITY_COLOR.low },
          }
        : {
            0: { cellWidth: 100 },
            1: { halign: "right", fontStyle: "bold" },
            2: {
              halign: "right",
              textColor: SEVERITY_COLOR.critical,
              fontStyle: "bold",
            },
            3: {
              halign: "right",
              textColor: SEVERITY_COLOR.high,
              fontStyle: "bold",
            },
            4: { halign: "right", textColor: SEVERITY_COLOR.medium },
            5: { halign: "right", textColor: SEVERITY_COLOR.low },
          },
    });
  }

  // ===================== RODAPÉ =====================
  generateFooter(doc);

  const safeLabel = teamLabel.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename =
    data.scope === "global"
      ? "DebitBoard_Relatorio_Executivo_Global.pdf"
      : `DebitBoard_Relatorio_Executivo_${safeLabel}.pdf`;

  doc.save(filename);
}
