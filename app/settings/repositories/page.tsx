"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import type { IRepository } from "@/types/IRepository";

// ============================================================================
// Configuração das Colunas
// ============================================================================

// Tipamos o array de colunas como Column<Repository>
const columns: Column<IRepository>[] = [
  { key: "name", label: "Nome do Repositório", sortable: true },
  {
    key: "project", 
    label: "Projeto",
    sortable: true, 
    render: (item: IRepository) => item.project?.name || "Sem projeto",
  },
  {
    key: "createdAt",
    label: "Criado em",
    sortable: true,
    width: "120px",
    className: "text-sm text-center text-apple-label-light dark:text-apple-label-dark",
    render: (item: IRepository) => new Date(item.createdAt).toLocaleDateString(),
  },
  {
    key: "actions",
    label: "Ações",
    sortable: false,
    width: "120px",
    render: () => (
      <span className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark">
        Em breve
      </span>
    ),
  },
];

function RepositoriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/azure/sync", { method: "POST" });
      if (res.ok) {
        alert("Sincronização concluída!");
      } else {
        const err = await res.json();
        alert("Erro na sincronização: " + (err.error || "Erro desconhecido"));
      }
    } catch (error) {
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
        title={projectId ? "Repositórios do Projeto" : "Repositórios do Tenant"}
        subtitle={
          projectId
            ? "Lista de repositórios pertencentes a este projeto."
            : "Gerencie os repositórios sincronizados automaticamente pelas buscas."
        }
        actions={
          <div className="flex items-center gap-2">
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
            {projectId && (
              <Link
                href="/settings/projects"
                className="flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para Projetos
              </Link>
            )}
          </div>
        }
      />

      <DataTable
        endpoint="/api/repositories"
        columns={columns}
        defaultSort={{ field: "name", order: "asc" }}
        defaultLimit={10}
        searchPlaceholder="Buscar repositórios (ex: name:repo-backend OR projectId:...)"
        searchContext="repositories"
        userId={session.user.id}
        projectId={projectId || undefined}
      />
    </div>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">
          Carregando página de repositórios...
        </div>
      }
    >
      <RepositoriesContent />
    </Suspense>
  );
}
