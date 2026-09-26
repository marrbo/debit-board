// hooks/useRangeState.ts
"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  parseRangeState,
  writeRangeState,
  DEFAULT_PRESET,
  type RangeState,
} from "@/lib/range-options";
import { useLocalSettings } from "./useLocalSettings";

const DEFAULT_STATE: RangeState = { mode: "preset", preset: DEFAULT_PRESET };

export interface UseRangeStateResult {
  /** Estado atual (URL > storage > default). */
  state: RangeState;
  /**
   * Chave estável para usar em deps de `useEffect` sem cair em loop.
   * Muda apenas quando um campo lógico do range realmente muda.
   */
  rangeKey: string;
  /** Persiste no storage + URL. */
  setState: (next: RangeState) => void;
  /** Volta para `{ mode: "preset", preset: "all" }`. */
  reset: () => void;
}

/**
 * Fonte única de leitura/escrita da janela temporal.
 *
 * Precedência de leitura:
 *  1. URL (`?range=30d` ou `?from=…&to=…`).
 *  2. Storage (`localSettings.range`).
 *  3. `{ mode: "preset", preset: "all" }`.
 *
 * Ao escrever, atualiza **ambos** — a URL para compartilhamento/refresh e o
 * storage para sobreviver a fechar a aba.
 *
 * O objeto retornado é memoizado por primitivos (`mode`, `preset`, `from`,
 * `to`), então `state` só muda de referência quando algum campo muda de fato.
 * Use `rangeKey` nas deps de efeitos que precisam reagir a mudanças de range.
 */
export function useRangeState(): UseRangeStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { settings, update } = useLocalSettings();

  const rawRange = searchParams.get("range");
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const storedRange = settings.range;

  const state = useMemo<RangeState>(() => {
    // URL tem precedência sempre que tiver qualquer coisa
    if (rawRange || rawFrom || rawTo) {
      return parseRangeState(searchParams);
    }
    // Sem URL → storage → default
    return storedRange ?? DEFAULT_STATE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRange, rawFrom, rawTo, storedRange]);

  const rangeKey = useMemo(() => {
    if (state.mode === "custom" && state.from && state.to) {
      return `custom:${state.from}:${state.to}`;
    }
    return `preset:${state.preset}`;
  }, [state.mode, state.from, state.to, state.preset]);

  const setState = useCallback(
    (next: RangeState) => {
      update({ range: next });

      const params = new URLSearchParams(searchParams.toString());
      writeRangeState(next, params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, update],
  );

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, [setState]);

  return { state, rangeKey, setState, reset };
}
