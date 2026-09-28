// hooks/useDashboardProfiles.ts
"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  DashboardProfileKind,
  DashboardProfileVisibility,
  IDashboardProfile,
  IDashboardWidgetRef,
} from "@/types/IDashboardProfile";

export interface CreateDashboardProfileInput {
  name: string;
  kind: DashboardProfileKind;
  visibility: DashboardProfileVisibility;
  layout: IDashboardWidgetRef[];
  tv?: {
    teamId?: string | null;
    refreshSec?: number;
    cycleTeams?: boolean;
  };
}

export interface UseDashboardProfilesResult {
  profiles: IDashboardProfile[];
  loading: boolean;
  /** Força refetch do servidor. */
  refresh: () => Promise<void>;
  favorite: (id: string) => Promise<void>;
  updateLayout: (id: string, layout: IDashboardWidgetRef[]) => Promise<void>;
  create: (input: CreateDashboardProfileInput) => Promise<IDashboardProfile>;
  /** Remove um perfil e invalida o cache global. */
  remove: (id: string) => Promise<void>;
}

// ============================================================
// Store singleton — compartilhado entre TODAS as instâncias do hook.
//
// Motivo: `DashboardProfileBar` e `app/page.tsx` chamam o mesmo hook.
// Sem estado global, cada instância teria seu próprio cache e o
// dropdown não veria perfis criados pela outra ponta.
// ============================================================
let profilesCache: IDashboardProfile[] = [];
let loadingCache = true;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

/**
 * Snapshots estáticos para SSR e primeira hidratação.
 *
 * Precisam ser **referências estáveis** — `useSyncExternalStore`
 * compara com `Object.is` e, se o valor mudar de referência a cada
 * render, entra em loop infinito.
 */
const SERVER_PROFILES_SNAPSHOT: IDashboardProfile[] = [];
const SERVER_LOADING_SNAPSHOT = true;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getProfilesSnapshot(): IDashboardProfile[] {
  return profilesCache;
}

function getLoadingSnapshot(): boolean {
  return loadingCache;
}

function getServerProfilesSnapshot(): IDashboardProfile[] {
  return SERVER_PROFILES_SNAPSHOT;
}

function getServerLoadingSnapshot(): boolean {
  return SERVER_LOADING_SNAPSHOT;
}

/**
 * Refetch dos perfis. Coalescido: chamadas concorrentes reaproveitam
 * o mesmo request in-flight — evita N requests quando duas instâncias
 * montam ao mesmo tempo.
 */
async function fetchProfiles(): Promise<void> {
  if (inflight) return inflight;

  loadingCache = true;
  emit();

  inflight = fetch("/api/dashboard-profiles", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then((json: { data?: IDashboardProfile[] }) => {
      profilesCache = json.data ?? [];
    })
    .catch(() => {
      profilesCache = [];
    })
    .finally(() => {
      loadingCache = false;
      inflight = null;
      emit();
    });

  return inflight;
}

// Bootstrap: dispara uma vez quando o módulo é carregado no client.
if (typeof window !== "undefined") {
  void fetchProfiles();
}

// ============================================================
// Hook público
// ============================================================
export function useDashboardProfiles(): UseDashboardProfilesResult {
  const profiles = useSyncExternalStore(
    subscribe,
    getProfilesSnapshot,
    getServerProfilesSnapshot,
  );
  const loading = useSyncExternalStore(
    subscribe,
    getLoadingSnapshot,
    getServerLoadingSnapshot,
  );

  const refresh = useCallback(async () => {
    await fetchProfiles();
  }, []);

  const favorite = useCallback(async (id: string) => {
    const res = await fetch(`/api/dashboard-profiles/${id}/favorite`, {
      method: "PUT",
    });
    if (!res.ok) return;
    await fetchProfiles();
  }, []);

  const updateLayout = useCallback(
    async (id: string, layout: IDashboardWidgetRef[]) => {
      const res = await fetch(`/api/dashboard-profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar layout no perfil.");
      }
      await fetchProfiles();
    },
    [],
  );

  const create = useCallback(
    async (input: CreateDashboardProfileInput): Promise<IDashboardProfile> => {
      const res = await fetch("/api/dashboard-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar perfil.");
      }
      await fetchProfiles();
      return data as IDashboardProfile;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/dashboard-profiles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao remover perfil.");
    }
    await fetchProfiles();
  }, []);

  return { profiles, loading, refresh, favorite, updateLayout, create, remove };
}
