// app/settings/dashboards/DashboardProfileModal.tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useFeedback } from "@/hooks/useFeedback";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import type {
  DashboardProfileKind,
  DashboardProfileVisibility,
  IDashboardProfile,
  IDashboardWidgetRef,
} from "@/types/IDashboardProfile";

interface DashboardProfileModalProps {
  profile?: IDashboardProfile;
  /**
   * Layout inicial usado quando criando. Quando ausente, o modal
   * copia o layout corrente do `useDashboardLayout()` — útil ao abrir
   * pelo Settings, onde não há contexto do Dashboard. Quando presente
   * (ex.: vindo do WidgetsMenu), usa exatamente esse layout.
   */
  initialLayout?: IDashboardWidgetRef[];
  /** Tipo pré-selecionado ao criar. Default: `"dashboard"`. */
  defaultKind?: DashboardProfileKind;
  onClose: () => void;
  onSaved: (profile: IDashboardProfile) => void;
}

/**
 * Modal de criação/edição de perfil.
 *
 * Ao criar com `initialLayout` ausente, usa o layout do `localStorage`
 * como base. Ao criar com `initialLayout`, captura o estado atual do
 * grid. Na edição, usa o layout do próprio perfil.
 *
 * Regra de TV: quando `cycleTeams === true`, o seletor de time é
 * desabilitado e limpo — o backend também força `teamId = null`.
 */
export default function DashboardProfileModal({
  profile,
  initialLayout,
  defaultKind = "dashboard",
  onClose,
  onSaved,
}: DashboardProfileModalProps) {
  const { toast } = useFeedback();
  const isEdit = Boolean(profile);

  const [name, setName] = useState(profile?.name ?? "");
  const [kind, setKind] = useState<DashboardProfileKind>(
    profile?.kind ?? defaultKind,
  );
  const [visibility, setVisibility] = useState<DashboardProfileVisibility>(
    profile?.visibility ?? "private",
  );
  const [teamId, setTeamId] = useState(
    profile?.tv?.teamId ? String(profile.tv.teamId) : "",
  );
  const [refreshSec, setRefreshSec] = useState(profile?.tv?.refreshSec ?? 60);
  const [cycleTeams, setCycleTeams] = useState(
    profile?.tv?.cycleTeams ?? false,
  );
  const [saving, setSaving] = useState(false);

  // Fallback: quando não há `initialLayout` e nem `profile`, captura
  // o layout do localStorage.
  const { allWidgets } = useDashboardLayout();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const layout: IDashboardWidgetRef[] = profile?.layout
        ? profile.layout
        : (initialLayout ??
          allWidgets.map((w) => ({
            widgetId: w.id,
            visible: w.visible,
            order: w.order,
            span: w.span,
          })));

      const payload: Record<string, unknown> = {
        name: name.trim(),
        kind,
        visibility,
        layout,
      };

      if (kind === "tv") {
        payload.tv = {
          teamId: cycleTeams ? null : teamId || null,
          refreshSec: Math.max(0, Math.floor(refreshSec)),
          cycleTeams,
        };
      }

      const res = await fetch(
        isEdit
          ? `/api/dashboard-profiles/${profile!._id}`
          : "/api/dashboard-profiles",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Erro ao salvar perfil.");
        return;
      }
      toast.success(isEdit ? "Perfil atualizado." : "Perfil criado.");
      onSaved(data as IDashboardProfile);
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-default dark:border-strong rounded-lg p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-heading">
            {isEdit ? "Editar Perfil" : "Salvar Como Novo Perfil"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-sunken/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
              autoFocus
              placeholder="Ex: Visão Executiva, TV Times SP"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Tipo
              </label>
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as DashboardProfileKind)
                }
                className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading"
              >
                <option value="dashboard">Dashboard</option>
                <option value="tv">TV</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                Visibilidade
              </label>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as DashboardProfileVisibility)
                }
                className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading"
              >
                <option value="private">Private</option>
                <option value="shared">Shared</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          {kind === "tv" && (
            <div className="space-y-3 p-3 border border-default rounded-lg bg-sunken/30">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Time
                </label>
                <input
                  type="text"
                  value={teamId}
                  disabled={cycleTeams}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="Deixe vazio para Global"
                  className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Refresh (segundos)
                </label>
                <input
                  type="number"
                  min={0}
                  value={refreshSec}
                  onChange={(e) =>
                    setRefreshSec(parseInt(e.target.value || "0", 10))
                  }
                  className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-heading">
                <input
                  type="checkbox"
                  checked={cycleTeams}
                  onChange={(e) => {
                    setCycleTeams(e.target.checked);
                    if (e.target.checked) setTeamId("");
                  }}
                />
                Ciclar entre times a cada refresh
              </label>
              {cycleTeams && (
                <p className="text-[11px] text-muted italic">
                  Ciclo ativo: o time fixo acima é ignorado.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar Perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
