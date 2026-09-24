"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  X,
  TimerReset,
  HatGlasses,
  Share2,
  Globe,
  LockIcon,
  Eye,
  DatabaseSearch,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { useFeedback } from "@/hooks/useFeedback";
import type { ISavedQuery } from "@/types/ISavedQuery";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

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
  temporary: <TimerReset size={18} className="text-muted" />,
  private: <HatGlasses size={18} className="text-muted" />,
  public: <Globe size={18} className="text-muted" />,
  shared: <Share2 size={18} className="text-muted" />,
};

// ============================================================
// Conteúdo
// ============================================================
function SavedQueriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useFeedback();
  const confirm = useConfirm();

  // Busca client-side (padrão SimpleColumnSearch)
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SavedQueryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const [bulkVisOpen, setBulkVisOpen] = useState(false);
  const [bulkVisIds, setBulkVisIds] = useState<string[]>([]);
  const [bulkVisValue, setBulkVisValue] =
    useState<ISavedQuery["visibility"]>("private");
  const [bulkVisSaving, setBulkVisSaving] = useState(false);

  const handleBulkVisibility = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setBulkVisIds(ids);
    setBulkVisValue("private");
    setBulkVisOpen(true);
  }, []);

  const handleBulkVisConfirm = async () => {
    setBulkVisSaving(true);
    try {
      const res = await fetch("/api/saved-query/bulk-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkVisIds, visibility: bulkVisValue }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || "Erro ao atualizar visibilidade.");
        return;
      }

      toast.success(
        data.modified === 1
          ? "Visibilidade atualizada."
          : `${data.modified} consultas atualizadas.`,
      );
      setBulkVisOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBulkVisSaving(false);
    }
  };

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

  const handleOpenEdit = useCallback(
    (item: ISavedQuery) => {
      const isOwner = item.sub === session?.user?.sub;
      if (!isOwner) {
        toast.error("Você só pode editar consultas criadas por você.");
        return;
      }
      setEditingId(String(item._id));
      setForm({
        name: item.name,
        queryString: item.queryString,
        context: item.context,
        visibility: item.visibility,
      });
      setIsModalOpen(true);
    },
    [session?.user?.sub, toast],
  );

  const handleDelete = useCallback(
    async (ids: string[], items: ISavedQuery[]) => {
      if (ids.length === 0) return;

      const isBulk = ids.length > 1;
      const single = !isBulk ? items[0] : null;

      // Nome seguro para exibir (fallback se `name` estiver vazio)
      const singleName = single?.name?.trim() || "consulta selecionada";

      const ok = await confirm({
        title: isBulk
          ? `Excluir ${ids.length} consultas salvas?`
          : "Excluir consulta salva?",
        message: isBulk
          ? `As ${ids.length} consultas selecionadas serão removidas permanentemente.\nEsta ação não pode ser desfeita.`
          : `A consulta "${singleName}" será removida permanentemente.\nEsta ação não pode ser desfeita.`,
        confirmLabel: "Excluir",
        confirmColor: "error",
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/saved-query?ids=${ids.join(",")}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Erro ao excluir consultas.");
          return;
        }

        const data = await res.json().catch(() => ({}));
        const deleted = data.deleted ?? ids.length;

        if (deleted < ids.length) {
          // Acontece quando o backend filtra por `sub` e algum item
          // não pertencia ao usuário (defesa em profundidade).
          toast.error(
            `${deleted} de ${ids.length} consultas excluídas. Algumas não pertencem a você.`,
          );
        } else {
          toast.success(
            deleted === 1
              ? "Consulta excluída."
              : `${deleted} consultas excluídas.`,
          );
        }

        setRefreshKey((prev) => prev + 1);
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
        toast.success(editingId ? "Consulta atualizada." : "Consulta criada.");
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
        render: (item) => {
          const isOwner = item.sub === session?.user?.sub;
          return (
            <div className="flex justify-center">
              {isOwner ? (
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
              ) : (
                <span
                  className="p-1.5 text-muted opacity-60 cursor-not-allowed"
                  title="Somente leitura — consulta de outro usuário"
                >
                  <LockIcon className="w-4 h-4" />
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [handleOpenEdit, session?.user?.sub],
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
      <Dialog
        open={bulkVisOpen}
        onClose={bulkVisSaving ? undefined : () => setBulkVisOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Mudar visibilidade de {bulkVisIds.length}{" "}
          {bulkVisIds.length === 1 ? "consulta" : "consultas"}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="bulk-vis-label">Visibilidade</InputLabel>
            <Select
              labelId="bulk-vis-label"
              label="Visibilidade"
              value={bulkVisValue}
              onChange={(e) =>
                setBulkVisValue(e.target.value as ISavedQuery["visibility"])
              }
            >
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="shared">Shared</MenuItem>
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="temporary">Temporary</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setBulkVisOpen(false)}
            disabled={bulkVisSaving}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleBulkVisConfirm}
            disabled={bulkVisSaving}
            variant="contained"
          >
            {bulkVisSaving ? "Salvando..." : "Aplicar"}
          </Button>
        </DialogActions>
      </Dialog>

      <PageHeader
        title="Consultas Salvas"
        icon={<DatabaseSearch className="w-10 h-10 text-brand" />}
        subtitle="Gerencie suas consultas DBQL reutilizáveis."
        search={{
          type: "simple",
          onSearch: handleSimpleSearch,
          userSub: session?.user?.sub?.toString() || session?.user?.sub,
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: "Buscar por nome, contexto, query...",
        }}
        actions={
          <button
            onClick={handleOpenCreate}
            className="flex group items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4 group-hover:animate-[spin_0.5s_linear_0.5]" />{" "}
            Nova Consulta
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
        rowSelectable={(item) => item.sub === session?.user?.sub}
        canDelete={true}
        onDelete={handleDelete}
        onRowClick={handleOpenEdit}
        filterColumn={filterColumn}
        filterValue={filterValue}
        actions={[
          {
            label: "Mudar visibilidade",
            icon: <Eye className="w-3.5 h-3.5 hover:text-white" />,
            onClick: (ids) => handleBulkVisibility(ids),
          },
        ]}
        renderCard={(item) => (
          <div
            className={`flex flex-col h-full p-4 rounded-lg hover:shadow-md hover:bg-page border bg-surface transition-colors ${
              item.sub === session?.user?.sub
                ? "border-brand/30 hover:border-brand/60"
                : "border-default dark:border-strong"
            }`}
          >
            {/* Header: ícone de visibilidade + título */}
            <div className="flex items-center gap-2 mb-3">
              <span className="shrink-0 flex items-center justify-center">
                {VISIBILITY_ICONS[item.visibility]}
              </span>
              <h3
                className="font-semibold text-body dark:text-body truncate flex-1 min-w-0"
                title={item.name}
              >
                {item.name}
              </h3>
            </div>

            {/* Divisor */}
            <div className="border-b border-subtle mb-3" />

            {/* Query — ocupa o espaço restante, limitado a 2 linhas */}
            <div className="flex-1 min-h-[2.5rem] mb-3 overflow-hidden">
              <p className="text-xs text-muted font-mono leading-snug line-clamp-2 break-all">
                {item.queryString}
              </p>
            </div>

            {/* Footer: contexto + data */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="pr-2 py-0.5 rounded bg-apple-tertiary-light/10 font-mono truncate max-w-[60%]">
                contexto: {item.context}
              </span>
              <span className="shrink-0 tabular-nums">
                {new Date(item.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        )}
      />

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-default dark:border-strong rounded-lg p-6 w-full max-w-lg shadow-2xl">
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
                  className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
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
                  className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 font-mono text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
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
                    className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading"
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
                    className="w-full bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading"
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
                  className="px-4 py-2 text-sm rounded-lg text-muted hover:text-heading transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand/80 disabled:opacity-50 transition-colors"
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
