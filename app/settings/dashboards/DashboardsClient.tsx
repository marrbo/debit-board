// app/settings/dashboards/DashboardsClient.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  LayoutDashboard,
  Plus,
  Star,
  Pencil,
  ExternalLink,
  Lock,
} from "lucide-react";
import PageHeader from "@/components/PageHeader/Header";
import { DataTable, type Column } from "@/components/DataTable";
import { useConfirm } from "@/hooks/useConfirm";
import { useFeedback } from "@/hooks/useFeedback";
import DashboardProfileModal from "./DashboardProfileModal";
import { useDashboardProfiles } from "@/hooks/useDashboardProfiles";
import type { IDashboardProfile } from "@/types/IDashboardProfile";

/**
 * Lista, favorita e edita perfis de dashboard salvos.
 *
 * O botão "+ Novo" abre o modal em modo criação com um layout default
 * (extraído de `DASHBOARD_WIDGETS`). A edição respeita o dono: só quem
 * criou pode editar/excluir; os demais podem favoritar e abrir.
 */
export default function DashboardsClient() {
  const { data: session, status } = useSession();
  const confirm = useConfirm();
  const { toast } = useFeedback();
  const { remove } = useDashboardProfiles();

  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<IDashboardProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  const sub = session?.user?.sub;

  const handleFavorite = useCallback(
    async (item: IDashboardProfile) => {
      try {
        const res = await fetch(
          `/api/dashboard-profiles/${item._id}/favorite`,
          { method: "PUT" },
        );
        if (!res.ok) {
          toast.error("Erro ao favoritar.");
          return;
        }
        setRefreshKey((k) => k + 1);
      } catch {
        toast.error("Erro de rede.");
      }
    },
    [toast],
  );

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      const ok = await confirm({
        title:
          ids.length === 1
            ? "Remover este perfil?"
            : `Remover ${ids.length} perfis?`,
        message:
          "Esta ação não pode ser desfeita. O layout será perdido, mas as " +
          "preferências locais do seu navegador continuam intactas.",
        confirmLabel: "Remover",
        confirmColor: "error",
      });
      if (!ok) return;

      let deleted = 0;
      for (const id of ids) {
        try {
          await remove(id);
          deleted++;
        } catch {
          // Individual falhou — segue com os demais
        }
      }
      toast.success(`${deleted} perfil(is) removido(s).`);
      setRefreshKey((k) => k + 1);
    },
    [confirm, toast, remove],
  );

  const columns = useMemo<Column<IDashboardProfile>[]>(
    () => [
      {
        key: "favorite",
        label: "",
        width: "44px",
        sortable: false,
        exportable: false,
        render: (item) => {
          const isFav = sub ? item.favorites.includes(sub) : false;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFavorite(item);
              }}
              title={
                isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              aria-label={
                isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              className="p-1 rounded hover:bg-sunken/60 transition-colors"
            >
              <Star
                className={`w-4 h-4 ${
                  isFav ? "fill-warning-500 text-warning-500" : "text-muted"
                }`}
              />
            </button>
          );
        },
      },
      { key: "name", label: "Nome", sortable: true },
      {
        key: "kind",
        label: "Tipo",
        sortable: true,
        width: "110px",
        align: "center",
        render: (item) => (
          <span className="px-2 py-0.5 rounded-full bg-sunken text-[10px] font-mono uppercase">
            {item.kind}
          </span>
        ),
      },
      {
        key: "visibility",
        label: "Visibilidade",
        width: "110px",
        sortable: true,
        align: "center",
      },
      {
        key: "layout",
        label: "Widgets",
        sortable: false,
        align: "center",
        width: "90px",
        render: (item) =>
          item.layout.filter((w) => w.visible).length +
          "/" +
          item.layout.length,
      },
      {
        key: "actions",
        label: "Ações",
        sortable: false,
        width: "140px",
        exportable: false,
        render: (item) => {
          const isOwner = item.sub === sub;
          return (
            <div className="flex items-center justify-center gap-1">
              <Link
                href={
                  item.kind === "tv"
                    ? `/tv?profile=${item._id}`
                    : `/?profile=${item._id}`
                }
                title="Abrir"
                className="p-1.5 rounded hover:bg-sunken/60 text-brand"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              {isOwner ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(item);
                  }}
                  title="Editar"
                  className="p-1.5 rounded hover:bg-sunken/60 text-brand"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              ) : (
                <span
                  className="p-1.5 text-muted opacity-60 cursor-not-allowed"
                  title="Somente o dono pode editar"
                >
                  <Lock className="w-4 h-4" />
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [sub, handleFavorite],
  );

  if (status === "loading") {
    return <div className="py-10 text-center text-muted">Carregando...</div>;
  }
  if (!session) return null;

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Dashboards"
        icon={<LayoutDashboard className="w-10 h-10 text-brand" />}
        subtitle="Layouts salvos de widgets do Dashboard e do Modo TV."
        search={{
          type: "simple",
          onSearch: (col, val) => {
            setFilterColumn(col);
            setFilterValue(val);
          },
          userSub: session.user.sub,
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: "Buscar por nome, tipo, visibilidade...",
        }}
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex group items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            Novo Perfil
          </button>
        }
      />

      <DataTable<IDashboardProfile>
        endpoint="/api/dashboard-profiles"
        columns={columns}
        defaultSort={{ field: "createdAt", order: "desc" }}
        defaultLimit={10}
        pdfTitle="Perfis de Dashboard"
        refreshKey={refreshKey}
        selectable
        rowSelectable={(item) => item.sub === sub}
        canDelete
        onDelete={(ids) => handleDelete(ids)}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      {creating && (
        <DashboardProfileModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {editing && (
        <DashboardProfileModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
