// hooks/useDashboardLayout.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSettings } from "./useLocalSettings";
import type { DashboardWidgetRef } from "@/lib/local-settings";

export type WidgetSpan = 2 | 3 | 4 | 6;

export interface DashboardWidgetMeta {
  id: string;
  label: string;
  defaultVisible?: boolean;
  defaultSpan: WidgetSpan;
  allowedSpans: WidgetSpan[];
  allowSpanEdit?: boolean;
  defaultOrder: number;
}

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  {
    id: "severity-status",
    label: "Severidade e Status",
    defaultSpan: 3,
    allowedSpans: [3, 4, 6],
    defaultOrder: 0,
  },
  {
    id: "category",
    label: "Distribuição por Categoria",
    defaultSpan: 3,
    allowedSpans: [2, 3, 4],
    defaultOrder: 1,
  },
  {
    id: "sast-timeline",
    label: "Evolução do Risco SAST",
    defaultSpan: 3,
    allowedSpans: [3, 4, 6],
    defaultOrder: 2,
  },
  {
    id: "executive",
    label: "Resumo Executivo",
    defaultSpan: 4,
    allowedSpans: [3, 4, 6],
    defaultOrder: 3,
  },
  {
    id: "category-pie",
    label: "Pizza por Categoria",
    defaultSpan: 2,
    allowedSpans: [2, 3, 4],
    defaultOrder: 4,
  },
  {
    id: "evolution",
    label: "Evolução das ocorrências",
    defaultSpan: 3,
    allowedSpans: [3, 4, 6],
    defaultOrder: 5,
  },
  {
    id: "top-projects",
    label: "Top Projetos",
    defaultSpan: 3,
    allowedSpans: [3, 4, 6],
    defaultOrder: 6,
  },
  {
    id: "projects-table",
    label: "Tabela de Projetos",
    defaultSpan: 6,
    allowedSpans: [6],
    allowSpanEdit: false,
    defaultOrder: 7,
  },
];

export interface OrderedWidget extends DashboardWidgetMeta {
  visible: boolean;
  order: number;
  span: WidgetSpan;
}

export interface UseDashboardLayoutResult {
  allWidgets: OrderedWidget[];
  widgets: OrderedWidget[];
  isVisible: (id: string) => boolean;
  toggle: (id: string) => void;
  move: (id: string, direction: "up" | "down") => void;
  setSpan: (id: string, span: WidgetSpan) => void;
  reset: () => void;
  /** True quando há override ativo e o usuário fez pelo menos uma edição. */
  isDirty: boolean;
  /** Layout com as edições atuais (pronto para salvar no perfil). `null` se sem override. */
  draftLayout: DashboardWidgetRef[] | null;
  /** Descarta as edições e volta ao layout do override original. */
  discardDraft: () => void;
}

function computeLayout(widgets: OrderedWidget[]): OrderedWidget[] {
  return widgets.filter((w) => w.visible);
}

export interface UseDashboardLayoutOptions {
  /**
   * Layout externo para sobrepor o do `localStorage`. Quando passado,
   * edições do usuário ficam em **draft** (estado local), prontas para
   * serem salvas no perfil via `draftLayout`.
   */
  overrideLayout?: DashboardWidgetRef[] | null;
  /**
   * Chave estável da fonte (ex.: `_id` do perfil). Quando muda, o draft
   * é descartado — evita carregar edições não salvas de um perfil
   * anterior ao trocar de perfil.
   */
  overrideKey?: string;
}

export function useDashboardLayout(
  options: UseDashboardLayoutOptions = {},
): UseDashboardLayoutResult {
  const { settings, update } = useLocalSettings();
  const { overrideLayout, overrideKey } = options;

  // Draft = edições feitas enquanto um override está ativo
  const [draftList, setDraftList] = useState<DashboardWidgetRef[] | null>(null);

  // Reset do draft quando a fonte muda (troca de perfil, sai do perfil, etc.)
  useEffect(() => {
    setDraftList(null);
  }, [overrideKey]);

  // Fonte efetiva: draft > override > localStorage
  const stored = draftList ?? overrideLayout ?? settings.dashboardLayout;

  const ordered = useMemo<OrderedWidget[]>(() => {
    const withOverrides = DASHBOARD_WIDGETS.map((meta) => {
      const entry = stored.find((e) => e.widgetId === meta.id);
      const span: WidgetSpan = entry?.span ?? meta.defaultSpan;
      return {
        ...meta,
        visible: entry?.visible ?? meta.defaultVisible ?? true,
        order: entry?.order ?? meta.defaultOrder,
        span,
        effectiveSpan: span,
      };
    });
    return withOverrides.sort((a, b) => a.order - b.order);
  }, [stored]);

  const widgets = useMemo(() => computeLayout(ordered), [ordered]);

  const isVisible = useCallback(
    (id: string) => ordered.find((w) => w.id === id)?.visible ?? true,
    [ordered],
  );

  const persist = useCallback(
    (list: OrderedWidget[]) => {
      const ref: DashboardWidgetRef[] = list.map((w, i) => ({
        widgetId: w.id,
        visible: w.visible,
        order: i,
        span: w.span,
      }));
      if (overrideLayout) {
        // Modo perfil: edita em draft (não grava no localStorage)
        setDraftList(ref);
      } else {
        // Modo local: grava no localStorage
        update({ dashboardLayout: ref });
      }
    },
    [overrideLayout, update],
  );

  const toggle = useCallback(
    (id: string) => {
      persist(
        ordered.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
      );
    },
    [ordered, persist],
  );

  const move = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = ordered.findIndex((w) => w.id === id);
      if (idx === -1) return;

      const current = ordered[idx];
      const delta = direction === "up" ? -1 : 1;

      let target = idx + delta;
      while (
        target >= 0 &&
        target < ordered.length &&
        ordered[target].visible !== current.visible
      ) {
        target += delta;
      }
      if (target < 0 || target >= ordered.length) return;

      const next = [...ordered];
      [next[idx], next[target]] = [next[target], next[idx]];
      persist(next);
    },
    [ordered, persist],
  );

  const setSpan = useCallback(
    (id: string, span: WidgetSpan) => {
      const meta = DASHBOARD_WIDGETS.find((m) => m.id === id);
      if (meta?.allowSpanEdit === false) return;
      persist(ordered.map((w) => (w.id === id ? { ...w, span } : w)));
    },
    [ordered, persist],
  );

  const reset = useCallback(() => {
    if (overrideLayout) {
      // Em modo perfil: "Resetar" limpa as edições, voltando ao override
      setDraftList(null);
    } else {
      update({ dashboardLayout: [] });
    }
  }, [overrideLayout, update]);

  const discardDraft = useCallback(() => {
    setDraftList(null);
  }, []);

  const isDirty = Boolean(overrideLayout && draftList !== null);

  return {
    allWidgets: ordered,
    widgets,
    isVisible,
    toggle,
    move,
    setSpan,
    reset,
    isDirty,
    draftLayout: draftList,
    discardDraft,
  };
}
