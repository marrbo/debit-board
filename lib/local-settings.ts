// lib/local-settings.ts

export interface DBQLQueryRef {
  page: string;
  id: string | null;
  visible: boolean;
}

export interface SlideToggleRef {
  page: string;
  key: string;
  value: string;
}

export interface LocalSettings {
  theme: "light" | "dark" | "system";
  settingsNav: boolean;
  wikiSidebar: boolean;
  team: string | null;
  dbql: DBQLQueryRef[];
  slideToggle: SlideToggleRef[];
}

export const DEFAULT_DBQL_VISIBLE = true;

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  theme: "system",
  settingsNav: true,
  wikiSidebar: true,
  team: null,
  dbql: [],
  slideToggle: [],
};

const STORAGE_KEY = "debit-board";

let cache: LocalSettings = DEFAULT_LOCAL_SETTINGS;
const listeners = new Set<() => void>();

// ============================================================
// Normalização
// ============================================================
function normalizeDBQL(raw: unknown): DBQLQueryRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object",
    )
    .map((entry) => ({
      page: String(entry.page ?? ""),
      id: typeof entry.id === "string" ? entry.id : null,
      visible:
        typeof entry.visible === "boolean"
          ? entry.visible
          : DEFAULT_DBQL_VISIBLE,
    }))
    .filter((entry) => entry.page !== "");
}

function normalizeSlideToggle(raw: unknown): SlideToggleRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object",
    )
    .map((entry) => ({
      page: String(entry.page ?? ""),
      key: String(entry.key ?? ""),
      value: typeof entry.value === "string" ? entry.value : "",
    }))
    .filter((entry) => entry.page !== "" && entry.key !== "");
}

function readFromStorage(): LocalSettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      ...DEFAULT_LOCAL_SETTINGS,
      ...parsed,
      team: typeof parsed.team === "string" ? parsed.team : null,
      dbql: normalizeDBQL(parsed.dbql),
      slideToggle: normalizeSlideToggle(parsed.slideToggle),
    };
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

function writeToStorage(next: LocalSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

// ============================================================
// Inicialização única no carregamento do módulo (client-only)
// ============================================================
if (typeof window !== "undefined") {
  cache = readFromStorage();
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    cache = readFromStorage();
    emit();
  });
}

// ============================================================
// API pública — snapshot puro
// ============================================================
export function getLocalSettings(): LocalSettings {
  return cache;
}

export function subscribeLocalSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function serialize(s: LocalSettings): string {
  return JSON.stringify(s);
}

export function updateLocalSettings(patch: Partial<LocalSettings>): LocalSettings {
  const next: LocalSettings = { ...cache, ...patch };

  // No-op real: nada muda → não reatribui cache, não emite, não re-renderiza.
  if (serialize(next) === serialize(cache)) {
    return cache;
  }

  cache = next;
  writeToStorage(cache);
  emit();
  return cache;
}

export function resetLocalSettings(): LocalSettings {
  cache = { ...DEFAULT_LOCAL_SETTINGS };
  writeToStorage(cache);
  emit();
  return cache;
}

// ============================================================
// Team (global)
// ============================================================
export function getTeam(): string | null {
  return cache.team;
}

export function setTeam(id: string): void {
  updateLocalSettings({ team: id });
}

export function clearTeam(): void {
  updateLocalSettings({ team: null });
}

// ============================================================
// Helpers DBQL (page → { id, visible })
// ============================================================
function upsertDBQLRef(
  page: string,
  patch: Partial<Omit<DBQLQueryRef, "page">>,
): void {
  const existing = cache.dbql.find((entry) => entry.page === page);
  const next: DBQLQueryRef = {
    page,
    id: existing?.id ?? null,
    visible: existing?.visible ?? DEFAULT_DBQL_VISIBLE,
    ...patch,
  };

  const filtered = cache.dbql.filter((entry) => entry.page !== page);
  const isDefaultState =
    next.id === null && next.visible === DEFAULT_DBQL_VISIBLE;

  updateLocalSettings({
    dbql: isDefaultState ? filtered : [...filtered, next],
  });
}

export function getDBQLRef(page: string): DBQLQueryRef | undefined {
  return cache.dbql.find((entry) => entry.page === page);
}

export function getDBQLQueryId(page: string): string | null {
  return getDBQLRef(page)?.id ?? null;
}

export function isSearchVisible(page: string): boolean {
  return getDBQLRef(page)?.visible ?? DEFAULT_DBQL_VISIBLE;
}

export function setDBQLQueryId(page: string, id: string): void {
  upsertDBQLRef(page, { id });
}

export function clearDBQLQueryId(page: string): void {
  upsertDBQLRef(page, { id: null });
}

export function setSearchVisible(page: string, visible: boolean): void {
  upsertDBQLRef(page, { visible });
}

export function toggleSearchVisible(page: string): void {
  upsertDBQLRef(page, { visible: !isSearchVisible(page) });
}

// ============================================================
// Helpers SlideToggle (page + key → value)
// ============================================================
export function getSlideToggleValue(
  page: string,
  key: string,
): string | null {
  return (
    cache.slideToggle.find((e) => e.page === page && e.key === key)?.value ??
    null
  );
}

export function setSlideToggleValue(
  page: string,
  key: string,
  value: string,
): void {
  const filtered = cache.slideToggle.filter(
    (e) => !(e.page === page && e.key === key),
  );
  updateLocalSettings({
    slideToggle: [...filtered, { page, key, value }],
  });
}

export function clearSlideToggleValue(page: string, key: string): void {
  updateLocalSettings({
    slideToggle: cache.slideToggle.filter(
      (e) => !(e.page === page && e.key === key),
    ),
  });
}