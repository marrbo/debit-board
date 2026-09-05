"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
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
import type { ISavedQuery } from "@/types/ISavedQuery";

// ----------------------------------------------------------------------------
// Tipos auxiliares para o formulário
// ----------------------------------------------------------------------------
type SavedQueryForm = {
  name: string;
  queryString: string;
  context: ISavedQuery["context"];
  visibility: ISavedQuery["visibility"];
};

const emptyForm: SavedQueryForm = {
  name: "",
  queryString: "",
  context: "repositories",
  visibility: "private",
};

function SavedQueriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Estado do modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SavedQueryForm>(emptyForm);
  const [loading, setLoading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Handlers memoizados
  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: ISavedQuery) => {
    setEditingId(item._id as unknown as string);
    setForm({
      name: item.name,
      queryString: item.queryString,
      context: item.context,
      visibility: item.visibility,
    });
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    
    const message =
      ids.length === 1
        ? "Tem certeza que deseja excluir esta consulta salva?"
        : `Tem certeza que deseja excluir ${ids.length} consultas salvas?`;

    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/saved-query?ids=${ids.join(',')}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert(
          ids.length === 1
            ? "Consulta excluída com sucesso!"
            : `${ids.length} consultas excluídas com sucesso!`
        );
        // ✅ Incrementa refreshKey para forçar o DataTable a recarregar
        setRefreshKey((prev) => prev + 1);
      } else {
        const err = await res.json();
        alert("Erro ao excluir: " + (err.error || "Erro desconhecido"));
      }
    } catch {
      alert("Erro de rede ao excluir.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const url = editingId ? `/api/saved-query` : `/api/saved-query`;
        const method = editingId ? "PUT" : "POST";
        const body = editingId ? { id: editingId, ...form } : form;

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          alert(editingId ? "Consulta atualizada!" : "Consulta criada!");
          setIsModalOpen(false);
          // ✅ Incrementa refreshKey para recarregar a tabela
          setRefreshKey((prev) => prev + 1);
        } else {
          const err = await res.json();
          alert("Erro: " + (err.error || "Erro desconhecido"));
        }
      } catch (error) {
        alert("Erro de rede ao salvar.");
      } finally {
        setLoading(false);
      }
    },
    [editingId, form],
  );

  // Colunas geradas dentro do componente (acesso aos handlers)
  const columns = useMemo<Column<ISavedQuery>[]>(
    () => [
      { key: "name", label: "Nome", sortable: true },
      {
        key: "queryString",
        label: "Query",
        sortable: false,
        render: (item: ISavedQuery) => (
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
        render: (item: ISavedQuery) => (
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
        render: (item: ISavedQuery) => (
          <div className="flex justify-center items-center">
            {item.visibility === "temporary" ? (
              <TimerReset size={20} className="text-apple-tertiary-light" />
            ) : item.visibility === "private" ? (
              <FolderLock size={20} className="text-apple-tertiary-light" />
            ) : item.visibility === "public" ? (
              <Globe size={20} className="text-apple-tertiary-light" />
            ) : (
              <Share2 size={20} className="text-apple-tertiary-light" />
            )}
          </div>
        ),
      },
      {
        key: "createdAt",
        label: "Criado em",
        sortable: true,
        width: "120px",
        className:
          "text-sm text-center text-apple-label-light dark:text-apple-label-dark",
        render: (item: ISavedQuery) =>
          new Date(item.createdAt).toLocaleDateString(),
      },
      {
        key: "actions",
        label: "Ações",
        sortable: false,
        width: "80px",
        render: (item: ISavedQuery) => (
          <div className="flex justify-center">
            <button
              onClick={() => handleOpenEdit(item)}
              className="p-1.5 rounded-lg hover:bg-apple-tertiary-light/10 text-apple-blue"
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

  if (status === "loading")
    return <div className="py-10 text-center">Carregando...</div>;

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Consultas Salvas"
        subtitle="Gerencie suas consultas DBQL reutilizáveis."
        actions={
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Consulta
          </button>
        }
      />

      <DataTable
        endpoint="/api/saved-query"
        columns={columns}
        defaultSort={{ field: "createdAt", order: "desc" }}
        defaultLimit={10}
        searchPlaceholder="Buscar consultas (ex: name:minha-query OR context:repositories)"
        searchContext="none"
        userId={session.user.id}
        refreshKey={refreshKey}
        selectable={true}
        canDelete={session.user.email === 'ayslanjohnson@debitboard.com'}
        onDelete={(ids) => handleDelete(ids)}
        // actions={[
        //   {
        //     label: 'Atribuir',
        //     icon: <UserPlus className="w-4 h-4" />,
        //     onClick: (ids, items) => handleAssign(ids, items),
        //     requiresSelection: true,
        //   },
        //   {
        //     label: 'Mudar Status',
        //     icon: <RefreshCw className="w-4 h-4" />,
        //     onClick: (ids, items) => handleStatusChange(ids, items),
        //   },
        // ]}
      />

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-apple-card-dark rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Editar Consulta" : "Nova Consulta"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-apple-tertiary-light/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-apple-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Query String
                </label>
                <textarea
                  value={form.queryString}
                  onChange={(e) =>
                    setForm({ ...form, queryString: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
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
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="observations">Observations</option>
                    <option value="projects">Projects</option>
                    <option value="repositories">Repositories</option>
                    <option value="stats">Stats</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
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
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="private">Private</option>
                    <option value="shared">Shared</option>
                    <option value="public">Public</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-apple-tertiary-light/10 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-lg bg-apple-blue text-white hover:bg-apple-blue/80 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar"}
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
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">
          Carregando página de consultas salvas...
        </div>
      }
    >
      <SavedQueriesContent />
    </Suspense>
  );
}
