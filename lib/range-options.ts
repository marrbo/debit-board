// lib/range-options.ts
// ⚠️ Client-safe: NÃO importar Mongoose, models, nem qualquer módulo server-only.

export type RangePreset = "1h" | "24h" | "7d" | "14d" | "30d" | "90d" | "all";
export type RangeMode = "preset" | "custom";

export interface RangeState {
  mode: RangeMode;
  preset: RangePreset;
  /** ISO. Só presente quando `mode === "custom"`. */
  from?: string;
  /** ISO. Só presente quando `mode === "custom"`. */
  to?: string;
}

export const RANGE_PRESETS: {
  value: RangePreset;
  label: string;
  short: string;
}[] = [
  { value: "1h", label: "Última hora", short: "1H" },
  { value: "24h", label: "Últimas 24 horas", short: "24H" },
  { value: "7d", label: "Últimos 7 dias", short: "7D" },
  { value: "14d", label: "Últimos 14 dias", short: "14D" },
  { value: "30d", label: "Últimos 30 dias", short: "30D" },
  { value: "90d", label: "Últimos 90 dias", short: "90D" },
  { value: "all", label: "Todo o período", short: "Tudo" },
];

export const DEFAULT_PRESET: RangePreset = "all";

const VALID_PRESETS = new Set<RangePreset>(RANGE_PRESETS.map((p) => p.value));

function isValidIso(s: string): boolean {
  return !Number.isNaN(new Date(s).getTime());
}

/**
 * Lê o estado de range dos query params.
 *
 * Precedência:
 *  1. `from` + `to` válidos → `{ mode: "custom" }`.
 *  2. `range` válido → `{ mode: "preset", preset }`.
 *  3. Nada → `{ mode: "preset", preset: "all" }`.
 */
export function parseRangeState(params: URLSearchParams): RangeState {
  const rawFrom = params.get("from");
  const rawTo = params.get("to");

  if (rawFrom && rawTo && isValidIso(rawFrom) && isValidIso(rawTo)) {
    return { mode: "custom", preset: DEFAULT_PRESET, from: rawFrom, to: rawTo };
  }

  const rawPreset = params.get("range");
  const preset =
    rawPreset && VALID_PRESETS.has(rawPreset as RangePreset)
      ? (rawPreset as RangePreset)
      : DEFAULT_PRESET;

  return { mode: "preset", preset };
}

/**
 * Aplica o estado num `URLSearchParams`, removendo chaves antigas.
 * Usado tanto para a barra de endereço quanto para montar fetches.
 */
export function writeRangeState(
  state: RangeState,
  params: URLSearchParams,
): void {
  params.delete("range");
  params.delete("from");
  params.delete("to");

  if (state.mode === "custom" && state.from && state.to) {
    params.set("from", state.from);
    params.set("to", state.to);
    return;
  }

  if (state.preset !== DEFAULT_PRESET) {
    params.set("range", state.preset);
  }
}

/** Rótulo curto para o botão. */
export function getRangeShortLabel(state: RangeState): string {
  if (state.mode === "custom" && state.from && state.to) {
    return "Personalizado";
  }
  return RANGE_PRESETS.find((p) => p.value === state.preset)?.short ?? "Tudo";
}

/** Rótulo longo para tooltip/aria-label. */
export function getRangeLongLabel(state: RangeState): string {
  if (state.mode === "custom" && state.from && state.to) {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return `${fmt.format(new Date(state.from))} → ${fmt.format(new Date(state.to))}`;
  }
  return (
    RANGE_PRESETS.find((p) => p.value === state.preset)?.label ??
    "Todo o período"
  );
}

/** Millis do preset. `0` = sem recorte. */
export function presetToMillis(preset: RangePreset): number {
  switch (preset) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "14d":
      return 14 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return 90 * 24 * 60 * 60 * 1000;
    case "all":
      return 0;
  }
}

// ---------- Sanitizadores server-safe ----------

export function sanitizePreset(raw: string | null | undefined): RangePreset {
  if (raw && VALID_PRESETS.has(raw as RangePreset)) return raw as RangePreset;
  return DEFAULT_PRESET;
}

export function sanitizeIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
