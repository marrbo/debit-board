// hooks/useLocalSettings.ts
"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  clearSlideToggleValue,
  DEFAULT_DBQL_VISIBLE,
  DEFAULT_LOCAL_SETTINGS,
  getLocalSettings,
  resetLocalSettings,
  setSearchVisible as setSearchVisibleStore,
  setSlideToggleValue,
  subscribeLocalSettings,
  toggleSearchVisible as toggleSearchVisibleStore,
  updateLocalSettings,
  type LocalSettings,
} from "@/lib/local-settings";

const getServerSnapshot = (): LocalSettings => DEFAULT_LOCAL_SETTINGS;

// ============================================================
// Base
// ============================================================
export function useLocalSettings() {
  const settings = useSyncExternalStore(
    subscribeLocalSettings,
    getLocalSettings,
    getServerSnapshot,
  );

  const update = useCallback(
    (patch: Partial<LocalSettings>) => updateLocalSettings(patch),
    [],
  );

  return { settings, update, reset: resetLocalSettings };
}

export function useLocalSetting<K extends keyof LocalSettings>(
  key: K,
): readonly [LocalSettings[K], (value: LocalSettings[K]) => void] {
  const { settings, update } = useLocalSettings();

  const setValue = useCallback(
    (value: LocalSettings[K]) =>
      update({ [key]: value } as Partial<LocalSettings>),
    [key, update],
  );

  return [settings[key], setValue] as const;
}

// ============================================================
// Team — setter estável (a chave do loop estava aqui)
// ============================================================
export function useTeam(): readonly [
  string | null,
  (id: string | null) => void,
] {
  const { settings, update } = useLocalSettings();

  const setTeam = useCallback(
    (id: string | null) => update({ team: id }),
    [update],
  );

  return [settings.team, setTeam] as const;
}

// ============================================================
// DBQL / searchVisible
// ============================================================
export function useSearchVisible(page: string) {
  const { settings } = useLocalSettings();

  const visible =
    settings.dbql.find((entry) => entry.page === page)?.visible ??
    DEFAULT_DBQL_VISIBLE;

  const setVisible = useCallback(
    (value: boolean) => setSearchVisibleStore(page, value),
    [page],
  );

  const toggle = useCallback(
    () => toggleSearchVisibleStore(page),
    [page],
  );

  return { visible, setVisible, toggle };
}

// ============================================================
// SlideToggle
// ============================================================
export function useSlideToggle<T extends string>(
  page: string,
  key: string,
  defaultValue: T,
): { value: T; setValue: (v: T) => void } {
  const { settings } = useLocalSettings();

  const stored = settings.slideToggle.find(
    (e) => e.page === page && e.key === key,
  )?.value;
  const value = (stored as T | undefined) ?? defaultValue;

  const setValue = useCallback(
    (v: T) => {
      if (v === defaultValue) clearSlideToggleValue(page, key);
      else setSlideToggleValue(page, key, v);
    },
    [page, key, defaultValue],
  );

  return { value, setValue };
}