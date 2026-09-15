"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  X,
  TimerReset,
  FolderLock,
  Share2,
  Globe,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { useFeedback } from "@/hooks/useFeedback";
import type { ISavedQuery } from "@/types/ISavedQuery";

// ============================================================
// Tipos
// ============================================================
type SavedQueryForm = {
  name: string;
  queryString: string;
  context: ISavedQuery["context"];
  visibility: ISavedQuery["visibility"];
};

const EMPTY_FORM: SavedQueryForm = {
  name: "",
  queryString: "",
  context: "repositories",
  visibility: "private",
};

const VISIBILITY_ICONS: Record<string, React.ReactNode> = {
  temporary: <TimerReset size={20} className="text-muted" />,
  private: <FolderLock size={20} className="text-muted" />,
  public: <Globe size={20} className="text-muted" />,
  shared: <Share2 size={20} className="text-muted" />,
};

// ============================================================
// Conteúdo
// ============================================================
function SavedQueriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  // Busca client-side (padrão SimpleColumnSearch)
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SavedQueryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // ============================================================
  // Handlers
  // ============================================================
  const handleSimpleSearch = useCallback(
    (column: string | null, value: string) => {
      setFilterColumn(column);
      setFilterValue(value);
    },
    [],
  );

  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: ISavedQuery) => {
    setEditingId(String(item._id));
    setForm({
      name: item.name,
      queryString: item.queryString,
      context: item.context,
      visibility: item.visibility,
    });
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;

      const ok = await confirm({
        title:
          ids.length === 1
            ? "Excluir consulta salva?"
            : `Excluir ${ids.length} consultas salvas?`,
        message:
          ids.length === 1
            ? "Esta ação não pode ser desfeita."
            : `As ${ids.length} consultas selecionadas serão removidas permanentemente.`,
        confirmLabel: "Excluir",
        variant: "danger",
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/saved-query?ids=${ids.join(",")}`, {
          method: "DELETE",
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(
            ids.length === 1
              ? "Consulta excluída."
              : `${data.deleted ?? ids.length} consultas excluídas.`,
          );
          setRefreshKey((prev) => prev + 1);
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Erro ao excluir consultas.");
        }
      } catch {
        toast.error("Erro de rede ao excluir.");
      }
    },
    [confirm, toast],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = "/api/saved-query";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(
          editingId ? "Consulta atualizada." : "Consulta criada.",
        );
        setIsModalOpen(false);
        setRefreshKey((prev) => prev + 1);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao salvar consulta.");
      }
    } catch {
      toast.error("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Colunas
  // ============================================================
  const columns = useMemo<Column<ISavedQuery>[]>(
    () => [
      { key: "name", label: "Nome", sortable: true },
      {
        key: "queryString",
        label: "Query",
        sortable: false,
        exportable: true,
        render: (item) => (
          <span className="block max-w-[300px] truncate text-xs font-mono">
            {item.queryString}
          </span>
        ),
      },
      {
        key: "context",
        label: "Contexto",
        sortable: true,
        align: "center",
        width: "120px",
        render: (item) => (
          <span className="px-2 py-1 rounded-full bg-apple-tertiary-light/10 text-xs font-medium font-mono">
            {item.context}
          </span>
        ),
      },
      {
        key: "visibility",
        label: "Visibilidade",
        width: "100px",
        sortable: true,
        align: "center",
        render: (item) => (
          <div className="flex justify-center items-center">
            {VISIBILITY_ICONS[item.visibility] ?? null}
          </div>
        ),
      },
      {
        key: "createdAt",
        label: "Criado em",
        sortable: true,
        width: "120px",
        className: "text-sm text-center text-heading dark:text-heading",
        render: (item) => new Date(item.createdAt).toLocaleDateString("pt-BR"),
      },
      {
        key: "actions",
        label: "Ações",
        sortable: false,
        width: "80px",
        exportable: false,
        render: (item) => (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(item);
              }}
              className="p-1.5 rounded-lg hover:bg-apple-tertiary-light/10 text-brand transition-colors"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleOpenEdit],
  );

  // ============================================================
  // Guards
  // ============================================================
  if (status === "loading") {
    return <div className="py-10 text-center text-muted">Carregando...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Consultas Salvas"
        subtitle="Gerencie suas consultas DBQL reutilizáveis."
        search={{
          type: "simple",
          onSearch: handleSimpleSearch,
          userId: session?.user?._id?.toString() || session?.user?.id,
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: "Buscar por nome, contexto, query...",
        }}
        actions={
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-brand hover:bg-brand/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
          >
            <Plus className="w-4 h-4" /> Nova Consulta
          </button>
        }
      />

      <DataTable<ISavedQuery>
        endpoint="/api/saved-query"
        columns={columns}
        defaultSort={{ field: "createdAt", order: "desc" }}
        defaultLimit={10}
        pdfTitle="Consultas Salvas"
        refreshKey={refreshKey}
        selectable
        canDelete={!!session.user.isAdmin}
        onDelete={handleDelete}
        onRowClick={handleOpenEdit}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-default dark:border-strong rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-heading dark:text-heading">
                {editingId ? "Editar Consulta" : "Nova Consulta"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-apple-tertiary-light/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface border border-default dark:border-strong rounded-xl px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Query String
                </label>
                <textarea
                  value={form.queryString}
                  onChange={(e) =>
                    setForm({ ...form, queryString: e.target.value })
                  }
                  className="w-full bg-surface border border-default dark:border-strong rounded-xl px-3 py-2 font-mono text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Contexto
                  </label>
                  <select
                    value={form.context}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        context: e.target.value as ISavedQuery["context"],
                      })
                    }
                    className="w-full bg-surface border border-default dark:border-strong rounded-xl px-3 py-2 text-sm text-heading"
                  >
                    <option value="observations">Observations</option>
                    <option value="projects">Projects</option>
                    <option value="repositories">Repositories</option>
                    <option value="stats">Stats</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Visibilidade
                  </label>
                  <select
                    value={form.visibility}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        visibility: e.target.value as ISavedQuery["visibility"],
                      })
                    }
                    className="w-full bg-surface border border-default dark:border-strong rounded-xl px-3 py-2 text-sm text-heading"
                  >
                    <option value="private">Private</option>
                    <option value="shared">Shared</option>
                    <option value="public">Public</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm rounded-xl text-muted hover:text-heading transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-xl bg-brand text-white hover:bg-brand/80 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SavedQueriesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted">
          Carregando página de consultas salvas...
        </div>
      }
    >
      <SavedQueriesContent />
    </Suspense>
  );
}