// utils/exportTeamsExecutivePDF.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  generateHeader,
  generateFooter,
} from "@/components/DataTable/pdfShared";
import { DEBIT_BOARD_LOGO_BASE64 } from "@/components/DataTable/logo";
import { BAND_META } from "@/lib/risk";
import type { TeamsExecutiveResponse } from "@/types/ITeamsExecutive";

const MARGIN = 10;

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
  white: [255, 255, 255] as [number, number, number],
};

const SEVERITY_COLOR = {
  critical: hexToRgb("#ef4444"),
  high: hexToRgb("#f97316"),
  medium: hexToRgb("#eab308"),
  low: hexToRgb("#22c55e"),
};

const SLA_COLOR = {
  overdue: hexToRgb("#dc2626"),
  atRisk: hexToRgb("#f97316"),
  onTrack: hexToRgb("#16a34a"),
};

interface ExportInput {
  data: TeamsExecutiveResponse;
  teamLabel: string;
}

/**
 * Relatório executivo — PDF.
 *
 * Estrutura:
 *  1. Risco Atual (hero com score, banda e mensagem)
 *  2. SLA + Aging
 *  3. Top Projetos por Risco
 *  4. Comparativo entre Times (fluxo)
 *  5. Categorias (fluxo)
 *  6. Padrões (fluxo)
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
  const isGlobal = data.scope === "global";

  generateHeader(doc, {
    title: "Resumo Executivo",
    subtitle: isGlobal
      ? "Comparativo entre times — Global"
      : `Time: ${teamLabel}`,
    generatedAt,
    logoBase64: DEBIT_BOARD_LOGO_BASE64,
  });

  let y = 30;

  const cs = data.aggregated.currentState;
  const hasCurrentData = cs.totals.total > 0;

  // ============================================================
  // 1. Risco Atual — hero
  // ============================================================
  if (hasCurrentData) {
    const meta = BAND_META[cs.risk.band];
    const bandColor = hexToRgb(meta.hex);

    // Bloco colorido
    doc.setFillColor(...bandColor);
    doc.roundedRect(MARGIN, y, tableWidth, 30, 3, 3, "F");

    // Score grande à esquerda
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(...STYLE.white);
    doc.text(String(cs.risk.score), MARGIN + 12, y + 21);

    // Banda + mensagem à direita do número
    doc.setFontSize(14);
    doc.text(meta.label.toUpperCase(), MARGIN + 42, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(meta.executive, MARGIN + 42, y + 19);

    doc.setFontSize(8);
    doc.text(meta.specialist, MARGIN + 42, y + 25);

    y += 36;

    // ---- KPIs horizontais ----
    const kpiLabels = ["Exposto", "Crítico", "Alto", "Médio", "Baixo"];
    const kpiValues = [
      cs.totals.total,
      cs.totals.critical,
      cs.totals.high,
      cs.totals.medium,
      cs.totals.low,
    ];
    const kpiColors: Array<[number, number, number]> = [
      STYLE.headingText,
      SEVERITY_COLOR.critical,
      SEVERITY_COLOR.high,
      SEVERITY_COLOR.medium,
      SEVERITY_COLOR.low,
    ];

    const kpiW = tableWidth / kpiLabels.length;
    kpiLabels.forEach((label, i) => {
      const cx = MARGIN + kpiW * i;
      doc.setDrawColor(220, 225, 232);
      doc.setLineWidth(0.1);
      doc.roundedRect(cx + 1, y, kpiW - 2, 14, 2, 2, "S");

      doc.setFontSize(7);
      doc.setTextColor(...STYLE.mutedText);
      doc.text(label.toUpperCase(), cx + kpiW / 2, y + 4.5, {
        align: "center",
      });

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...kpiColors[i]);
      doc.text(String(kpiValues[i]), cx + kpiW / 2, y + 11, {
        align: "center",
      });
    });

    y += 20;

    // ---- SLA + Aging em duas colunas ----
    const colW = (tableWidth - 6) / 2;

    // SLA
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("SLA", MARGIN, y + 3);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...STYLE.mutedText);
    const slaText = `Em dia: ${cs.totals.onTrack} · Em risco: ${cs.totals.atRisk} · Vencido: ${cs.totals.overdue}`;
    doc.text(slaText, MARGIN + 10, y + 3);

    // Barra
    const barY = y + 6;
    const barH = 4;
    const totalSla = cs.totals.onTrack + cs.totals.atRisk + cs.totals.overdue;
    if (totalSla > 0) {
      let xOff = MARGIN;
      const segs = [
        { v: cs.totals.onTrack, c: SLA_COLOR.onTrack },
        { v: cs.totals.atRisk, c: SLA_COLOR.atRisk },
        { v: cs.totals.overdue, c: SLA_COLOR.overdue },
      ];
      for (const seg of segs) {
        if (seg.v === 0) continue;
        const w = (seg.v / totalSla) * colW;
        doc.setFillColor(...seg.c);
        doc.rect(xOff, barY, w, barH, "F");
        xOff += w;
      }
    }

    // Aging
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Tempo em aberto", MARGIN + colW + 6, y + 3);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...STYLE.mutedText);
    const agingText = `0–30d: ${cs.aging.days0To30} · 31–60d: ${cs.aging.days31To60} · 61–90d: ${cs.aging.days61To90} · 90d+: ${cs.aging.days90Plus}`;
    doc.text(agingText, MARGIN + colW + 6, y + 9);

    // Barra aging
    const agingColors: Record<string, [number, number, number]> = {
      d0: hexToRgb("#16a34a"),
      d30: hexToRgb("#eab308"),
      d60: hexToRgb("#f97316"),
      d90: hexToRgb("#dc2626"),
    };
    const totalAging =
      cs.aging.days0To30 +
      cs.aging.days31To60 +
      cs.aging.days61To90 +
      cs.aging.days90Plus;
    if (totalAging > 0) {
      let xOff = MARGIN + colW + 6;
      const segs = [
        { v: cs.aging.days0To30, c: agingColors.d0 },
        { v: cs.aging.days31To60, c: agingColors.d30 },
        { v: cs.aging.days61To90, c: agingColors.d60 },
        { v: cs.aging.days90Plus, c: agingColors.d90 },
      ];
      for (const seg of segs) {
        if (seg.v === 0) continue;
        const w = (seg.v / totalAging) * colW;
        doc.setFillColor(...seg.c);
        doc.rect(xOff, barY, w, barH, "F");
        xOff += w;
      }
    }

    y += 14;
  }

  // ============================================================
  // 2. Top Projetos por Risco
  // ============================================================
  if (cs.projects.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Top projetos por exposição atual", MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [
        [
          "Projeto",
          "Time",
          "Risco",
          "Total",
          "Crítico",
          "Alto",
          "Médio",
          "Baixo",
          "SLA vencido",
        ],
      ],
      body: cs.projects.map((p) => [
        p.project,
        p.teamName,
        String(p.risk.score),
        String(p.total),
        String(p.critical || 0),
        String(p.high || 0),
        String(p.medium || 0),
        String(p.low || 0),
        String(p.overdue || 0),
      ]),
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
        0: { cellWidth: 70, fontStyle: "bold" },
        1: { cellWidth: 30, textColor: STYLE.mutedText },
        2: { halign: "right", fontStyle: "bold" },
        3: { halign: "right", fontStyle: "bold" },
        4: {
          halign: "right",
          textColor: SEVERITY_COLOR.critical,
          fontStyle: "bold",
        },
        5: {
          halign: "right",
          textColor: SEVERITY_COLOR.high,
          fontStyle: "bold",
        },
        6: { halign: "right", textColor: SEVERITY_COLOR.medium },
        7: { halign: "right", textColor: SEVERITY_COLOR.low },
        8: { halign: "right", textColor: SLA_COLOR.overdue, fontStyle: "bold" },
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 12;
  }

  // ============================================================
  // 3. Comparativo entre Times (fluxo)
  // ============================================================
  if (data.teams.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Atividade no período — Comparativo entre times", MARGIN, y);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...STYLE.mutedText);
    doc.text("(respeita a janela temporal aplicada ao filtro)", MARGIN + 92, y);

    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [
        [
          "Time",
          "Risco atual",
          "Total",
          "Crítico",
          "Alto",
          "Médio",
          "Baixo",
          "Abertas",
          "Corrigidas",
          "Recorrentes",
          "Não corrigir",
        ],
      ],
      body: data.teams.map((t) => [
        t.teamName,
        String(t.currentState.risk.score),
        String(t.totals.total),
        String(t.totals.critical),
        String(t.totals.high),
        String(t.totals.medium),
        String(t.totals.low),
        String(t.totals.open),
        String(t.totals.resolved),
        String(t.totals.recurring),
        String(t.totals.wontFix),
      ]),
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
        0: { cellWidth: 38, fontStyle: "bold" },
        1: { halign: "right", fontStyle: "bold" },
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
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
      },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 12;
  }

  // ============================================================
  // 4. Categorias (fluxo)
  // ============================================================
  if (data.aggregated.categories.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
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
      bodyStyles: { textColor: STYLE.bodyText, fontSize: 8, valign: "middle" },
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
  // 5. Padrões (fluxo)
  // ============================================================
  if (data.aggregated.patterns.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...STYLE.headingText);
    doc.text("Top padrões de detecção", MARGIN, y);
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
      bodyStyles: { textColor: STYLE.bodyText, fontSize: 8, valign: "middle" },
      alternateRowStyles: { fillColor: STYLE.altRow },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 90, textColor: STYLE.mutedText },
        2: { halign: "right", fontStyle: "bold" },
      },
    });
  }

  generateFooter(doc);

  const safeLabel = teamLabel.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = isGlobal
    ? "DebitBoard_Relatorio_Executivo_Global.pdf"
    : `DebitBoard_Relatorio_Executivo_${safeLabel}.pdf`;

  doc.save(filename);
}
