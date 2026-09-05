"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, FolderPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import ProjectDrawer from "@/components/ProjectDrawer";
import BulkAssignTeamModal from "@/components/BulkAssignTeamModal";
import type { IProject } from "@/types/IProject";
import type { Column } from '@/components/DataTable';

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
        className="inline-flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
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

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/azure/sync", { method: "POST" });
      if (res.ok) {
        alert("Sincronização concluída!");
        setRefreshKey(prev => prev + 1);
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
        subtitle="Gerencie os projetos do Tenant. Projetos possuem repositórios vinculados."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssignModal(true)}
              disabled={selectedProjectIds.length === 0}
              className="flex items-center gap-2 bg-apple-tertiary-light/10 hover:bg-apple-tertiary-light/20 disabled:opacity-50 text-apple-label-light dark:text-apple-label-dark px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm border border-apple-border-light dark:border-apple-border-dark"
            >
              <FolderPlus className="w-4 h-4" /> Atribuir a Time
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue/80 disabled:opacity-50 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Sincronizar
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
        defaultSort={{ field: "createdAt", order: "desc" }}
        defaultLimit={10}
        searchPlaceholder="Buscar repositórios (ex: name:repo-backend OR projectId:...)"
        searchContext="repositories"
        userId={session.user.id}
        // onRowClick={(project: unknown) => setSelectedProject(project as IProject)}
        onSelectionChange={setSelectedProjectIds}
        selectable={true}
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
            setRefreshKey(prev => prev + 1);
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
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">
          Carregando página de projetos...
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}