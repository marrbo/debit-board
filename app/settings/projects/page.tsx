"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, FolderPlus, FolderGit2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import ProjectDrawer from "@/components/ProjectDrawer";
import BulkAssignTeamModal from "@/components/BulkAssignTeamModal";
import type { IProject } from "@/types/IProject";
import type { Column } from "@/components/DataTable";

const columns: Column<IProject>[] = [
  { key: "name", label: "Nome do Projeto", sortable: true },
  {
    key: "repositoryCount",
    label: "Repositórios",
    sortable: true,
    render: (item: IProject) => item.repositoryCount || 0,
  },
  {
    key: "actions",
    label: "Ações",
    sortable: false,
    width: "160px",
    render: (item: IProject) => (
      <Link
        href={`/settings/repositories?projectId=${item._id}`}
        className="inline-flex items-center gap-2 bg-page dark:bg-surface border border-default dark:border-strong text-heading dark:text-heading hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      >
        Ver Repositórios
      </Link>
    ),
  },
];

function ProjectsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<IProject | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  const handleSimpleSearch = (column: string | null, value: string) => {
    setFilterColumn(column);
    setFilterValue(value);
    // Reset para a primeira página é feito pelo DataTable via useEffect? Não, precisa controlar aqui?
    // O DataTable já não renderiza busca, então resetamos a página manualmente? Vamos deixar o DataTable lidar com isso via filterValue (client-side).
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/azure/sync", { method: "POST" });
      if (res.ok) {
        alert("Sincronização concluída!");
        setRefreshKey((prev) => prev + 1);
      } else {
        const err = await res.json();
        alert("Erro na sincronização: " + (err.error || "Erro desconhecido"));
      }
    } catch {
      alert("Erro de rede ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  if (status === "loading")
    return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Projetos"
        icon={<FolderGit2 className="w-10 h-10 text-brand" />}
        subtitle="Gerencie os projetos do Tenant. Projetos possuem repositórios vinculados."
        search={{
          type: "simple",
          onSearch: handleSimpleSearch,
          userSub: session?.user?.sub?.toString(),
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: "Buscar projetos (ex: name:MeuProjeto OR projectId:...)",
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssignModal(true)}
              disabled={selectedProjectIds.length === 0}
              className="flex items-center gap-2 btn-secondary"
            >
              <FolderPlus className="w-4 h-4" /> Atribuir a Time
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center group gap-2 btn-primary"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 group-hover:animate-[spin_0.5s_linear_1]" />{" "}
                  Sincronizar
                </>
              )}
            </button>
          </div>
        }
      />

      <DataTable
        key={refreshKey}
        endpoint="/api/projects"
        columns={columns}
        defaultSort={{ field: "name", order: "asc" }}
        defaultLimit={8}
        pdfTitle="Projetos"
        selectable={true}
        onRowClick={(project: unknown) =>
          setSelectedProject(project as IProject)
        }
        onSelectionChange={setSelectedProjectIds}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      <ProjectDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      {showAssignModal && (
        <BulkAssignTeamModal
          projectIds={selectedProjectIds}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setSelectedProjectIds([]);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted dark:text-muted">
          Carregando página de projetos...
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
