"use client";

import { Suspense, useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import TeamDrawer from "@/components/TeamDrawer";
import type { Column } from "@/components/DataTable";
import type { ITeam } from "@/types/ITeam";
import { Plus, UserGroup } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { useFeedback } from "@/hooks/useFeedback";

// ============================================================
// Colunas
// ============================================================
const columns: Column<ITeam>[] = [
  { key: "name", label: "Nome do Time", sortable: true },
  { key: "description", label: "Descrição", sortable: true },
  {
    key: "projectCount",
    label: "Projetos",
    sortable: true,
    align: "center",
    width: "100px",
    headerClassName: "items-center text-center",
    render: (item: ITeam) => item.projectCount || 0,
  },
  {
    key: "actions",
    label: "Ações",
    sortable: false,
    width: "160px",
    render: (item: ITeam) => (
      <Link
        href={`/?teamId=${item._id.toString()}`}
        role="button"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 bg-page dark:bg-surface border border-default dark:border-strong text-heading dark:text-heading px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      >
        Ver Dashboard
      </Link>
    ),
  },
];

// ============================================================
// Conteúdo
// ============================================================
function TeamsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useFeedback();

  const [selectedTeam, setSelectedTeam] = useState<ITeam | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  const handleSimpleSearch = useCallback(
    (column: string | null, value: string) => {
      setFilterColumn(column);
      setFilterValue(value);
    },
    [],
  );

  // ============================================================
  // Delete (single + bulk)
  // ============================================================
  const handleDelete = useCallback(
    async (ids: string[], items: ITeam[]) => {
      if (ids.length === 0) return;

      const isBulk = ids.length > 1;
      const single = !isBulk ? items[0] : null;
      const singleName = single?.name?.trim() || "time selecionado";

      const ok = await confirm({
        title: isBulk ? `Excluir ${ids.length} times?` : "Excluir time?",
        message: isBulk
          ? `Os ${ids.length} times selecionados serão removidos permanentemente.\nTimes com projetos vinculados não serão excluídos.\nEsta ação não pode ser desfeita.`
          : `O time "${singleName}" será removido permanentemente.\nSe houver projetos vinculados, a exclusão será bloqueada.\nEsta ação não pode ser desfeita.`,
        confirmLabel: "Excluir",
        confirmColor: "error",
      });
      if (!ok) return;

      try {
        const res = await fetch(`/api/teams?ids=${ids.join(",")}`, {
          method: "DELETE",
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          // Times com projetos vinculados
          toast.error(
            data.error ||
              "Alguns times possuem projetos vinculados e não foram excluídos.",
          );
          return;
        }

        if (!res.ok) {
          toast.error(data.error || "Erro ao excluir times.");
          return;
        }

        const deleted = data.deleted ?? ids.length;

        if (deleted < ids.length) {
          toast.error(
            `${deleted} de ${ids.length} times excluídos. Alguns podem ter sido bloqueados por projetos vinculados.`,
          );
        } else {
          toast.success(
            deleted === 1 ? "Time excluído." : `${deleted} times excluídos.`,
          );
        }

        setRefreshKey((prev) => prev + 1);
      } catch {
        toast.error("Erro de rede ao excluir.");
      }
    },
    [confirm, toast],
  );

  // ============================================================
  // Guards
  // ============================================================
  if (status === "loading") {
    return <div className="py-10 text-center">Carregando...</div>;
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
        title="Times"
        icon={<UserGroup className="w-10 h-10 text-brand" />}
        subtitle="Gerencie os times. Times possuem projetos vinculados."
        actions={
          <button
            onClick={() => setSelectedTeam({} as ITeam)}
            className="flex group items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4 group-hover:animate-[spin_0.5s_linear_0.5]" />{" "}
            Novo Time
          </button>
        }
        search={{
          type: "simple",
          onSearch: handleSimpleSearch,
          userSub: session?.user?.sub?.toString(),
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: "Filtrar times...",
        }}
      />

      <DataTable<ITeam>
        key={refreshKey}
        endpoint="/api/teams?includeGlobal=false"
        columns={columns}
        defaultSort={{ field: "name", order: "asc" }}
        defaultLimit={8}
        pdfTitle="Times"
        refreshKey={refreshKey}
        selectable
        canDelete={session.user.isAdmin === true}
        onDelete={handleDelete}
        onRowClick={(team) => setSelectedTeam(team)}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      <TeamDrawer
        team={selectedTeam}
        onClose={() => {
          setSelectedTeam(null);
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center">Carregando página de times...</div>
      }
    >
      <TeamsContent />
    </Suspense>
  );
}
