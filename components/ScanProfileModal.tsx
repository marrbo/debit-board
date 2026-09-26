"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

type Severity = "low" | "medium" | "high" | "critical";

interface PatternOption {
  _id: string;
  name: string;
  category: string;
  severity: Severity;
}

interface ScanProfile {
  _id: string;
  name: string;
  description?: string;
  patternIds: string[];
}

interface ScanProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (profileId: string | null) => Promise<void>;
  running: boolean;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  low: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
};

const DEFAULT_OPTION_VALUE = "__default__";
const NEW_OPTION_VALUE = "__new__";

export default function ScanProfileModal({
  isOpen,
  onClose,
  onRun,
  running,
}: ScanProfileModalProps) {
  const [patterns, setPatterns] = useState<PatternOption[]>([]);
  const [profiles, setProfiles] = useState<ScanProfile[]>([]);
  const [selection, setSelection] = useState<string>(DEFAULT_OPTION_VALUE);
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(
    new Set(),
  );
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDefault = selection === DEFAULT_OPTION_VALUE;
  const isCreating = selection === NEW_OPTION_VALUE;
  const isEditable = isCreating;

  // Carrega patterns + profiles ao abrir
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/sast/patterns").then((r) => r.json()),
      fetch("/api/sast/profiles").then((r) => r.json()),
    ])
      .then(([patternsData, profilesData]) => {
        if (cancelled) return;
        const list: PatternOption[] = patternsData.patterns ?? [];
        setPatterns(list);
        setProfiles(profilesData.profiles ?? []);
        setSelection(DEFAULT_OPTION_VALUE);
        setSelectedPatterns(new Set(list.map((p) => p._id)));
        setNewProfileName("");
        setNewProfileDescription("");
        setSearchQuery("");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar dados.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Aplica seleção do dropdown ao estado de checkboxes
  useEffect(() => {
    if (!isOpen) return;
    if (selection === DEFAULT_OPTION_VALUE) {
      setSelectedPatterns(new Set(patterns.map((p) => p._id)));
      return;
    }
    if (selection === NEW_OPTION_VALUE) {
      setSelectedPatterns(new Set());
      return;
    }
    const profile = profiles.find((p) => p._id === selection);
    if (profile) setSelectedPatterns(new Set(profile.patternIds));
  }, [selection, profiles, patterns, isOpen]);

  const filteredPatterns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patterns;
    return patterns.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [patterns, searchQuery]);

  const groupedPatterns = useMemo(() => {
    const groups = new Map<string, PatternOption[]>();
    for (const p of filteredPatterns) {
      const arr = groups.get(p.category) ?? [];
      arr.push(p);
      groups.set(p.category, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPatterns]);

  const togglePattern = useCallback(
    (id: string) => {
      if (!isEditable) return;
      setSelectedPatterns((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [isEditable],
  );

  const toggleCategory = useCallback(
    (category: string) => {
      if (!isEditable) return;
      const ids = filteredPatterns
        .filter((p) => p.category === category)
        .map((p) => p._id);
      setSelectedPatterns((prev) => {
        const next = new Set(prev);
        const allSelected = ids.every((id) => next.has(id));
        ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
        return next;
      });
    },
    [filteredPatterns, isEditable],
  );

  const handleSelectAll = useCallback(() => {
    if (!isEditable) return;
    setSelectedPatterns(new Set(patterns.map((p) => p._id)));
  }, [patterns, isEditable]);

  const handleClearAll = useCallback(() => {
    if (!isEditable) return;
    setSelectedPatterns(new Set());
  }, [isEditable]);

  const handleSaveProfile = useCallback(async () => {
    if (!newProfileName.trim() || selectedPatterns.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sast/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfileName.trim(),
          description: newProfileDescription.trim() || undefined,
          patternIds: Array.from(selectedPatterns),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar perfil.");
      const created: ScanProfile = data.profile;
      setProfiles((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelection(created._id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }, [newProfileName, newProfileDescription, selectedPatterns]);

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm("Excluir este perfil?")
      ) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sast/profiles/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Erro ao excluir perfil.");
        }
        setProfiles((prev) => prev.filter((p) => p._id !== id));
        if (selection === id) setSelection(DEFAULT_OPTION_VALUE);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao excluir perfil.",
        );
      } finally {
        setLoading(false);
      }
    },
    [selection],
  );

  const handleRun = useCallback(async () => {
    const profileId =
      selection === DEFAULT_OPTION_VALUE || selection === NEW_OPTION_VALUE
        ? null
        : selection;
    await onRun(profileId);
  }, [onRun, selection]);

  if (!isOpen) return null;

  const selectedCount = selectedPatterns.size;
  const canRun =
    !running && !loading && !saving && (isDefault || selectedCount > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurar Scan SAST
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Escolha um perfil salvo ou selecione patterns manualmente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-lg p-3 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seletor de perfil */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Perfil de scan
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                  disabled={loading || running}
                  className="w-full appearance-none rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50"
                >
                  <option value={DEFAULT_OPTION_VALUE}>
                    Default — todos os patterns
                  </option>
                  {profiles.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                  <option value={NEW_OPTION_VALUE}>+ Novo perfil…</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              </div>

              {selection !== DEFAULT_OPTION_VALUE &&
                selection !== NEW_OPTION_VALUE && (
                  <button
                    onClick={() => handleDeleteProfile(selection)}
                    disabled={loading || running}
                    className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-500 hover:text-red-400 hover:border-red-400/50 disabled:opacity-50"
                    title="Excluir perfil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
            </div>
          </div>

          {/* Campos de novo perfil */}
          {isCreating && (
            <div className="grid grid-cols-1 gap-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40">
              <input
                type="text"
                placeholder="Nome do perfil (obrigatório)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                disabled={saving || running}
                className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newProfileDescription}
                onChange={(e) => setNewProfileDescription(e.target.value)}
                disabled={saving || running}
                className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
          )}

          {/* Barra de busca + ações */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar pattern por nome ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            {isEditable && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Todos
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Nenhum
                </button>
              </>
            )}
          </div>

          {/* Lista de patterns */}
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 max-h-80 overflow-y-auto divide-y divide-gray-200 dark:divide-slate-800">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Carregando patterns…
              </div>
            ) : groupedPatterns.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-slate-400">
                Nenhum pattern encontrado.
              </div>
            ) : (
              groupedPatterns.map(([category, items]) => {
                const allSelected = items.every((p) =>
                  selectedPatterns.has(p._id),
                );
                return (
                  <div key={category} className="p-2">
                    <button
                      onClick={() => toggleCategory(category)}
                      disabled={!isEditable}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs font-semibold uppercase tracking-wider ${
                        isEditable
                          ? "hover:bg-gray-100 dark:hover:bg-slate-800"
                          : "cursor-default"
                      } ${
                        allSelected
                          ? "text-brand"
                          : "text-gray-500 dark:text-slate-400"
                      }`}
                    >
                      <span className="flex-1">{category}</span>
                      <span className="text-[10px] opacity-70">
                        {
                          items.filter((p) => selectedPatterns.has(p._id))
                            .length
                        }
                        /{items.length}
                      </span>
                    </button>

                    <div className="mt-1 space-y-0.5">
                      {items.map((pattern) => {
                        const checked = selectedPatterns.has(pattern._id);
                        return (
                          <label
                            key={pattern._id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                              isEditable
                                ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800"
                                : "cursor-default"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePattern(pattern._id)}
                              disabled={!isEditable}
                              className="w-4 h-4 accent-brand rounded border-gray-300 dark:border-slate-600"
                            />
                            <span className="flex-1 text-gray-900 dark:text-white">
                              {pattern.name}
                            </span>
                            <span
                              className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[pattern.severity]}`}
                            >
                              {pattern.severity}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-xs text-gray-500 dark:text-slate-400">
            {isDefault
              ? "Modo Default: todos os patterns ativos serão executados."
              : `${selectedCount} pattern${selectedCount === 1 ? "" : "s"} selecionado${selectedCount === 1 ? "" : "s"}.`}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {isCreating && (
              <button
                onClick={handleSaveProfile}
                disabled={
                  saving ||
                  running ||
                  !newProfileName.trim() ||
                  selectedPatterns.size === 0
                }
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:drop-shadow-lg transition-all"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar perfil
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={running}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex items-center gap-2 bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executando…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Executar Scan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
