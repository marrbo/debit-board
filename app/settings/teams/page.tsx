"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import TeamDrawer from "@/components/TeamDrawer";
import type { Column } from '@/components/DataTable';
import type { ITeam } from "@/types/ITeam";

const columns: Column<ITeam>[] = [
  { key: "name", label: "Nome do Time", sortable: true },
  {
    key: "projectCount",
    label: "Projetos",
    sortable: true,
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
        className="inline-flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
      >
        Ver Dashboard
      </Link>
    ),
  },
];

function TeamsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState<ITeam | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (status === "loading") return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Times"
        subtitle="Gerencie os times. Times possuem projetos vinculados."
        actions={
          <button
            onClick={() => setSelectedTeam({} as ITeam)}
            className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm"
          >
            Criar Time
          </button>
        }
      />

      <DataTable
        key={refreshKey}
        endpoint="/api/teams"
        columns={columns}
        defaultSort={{ field: "createdAt", order: "desc" }}
        defaultLimit={10}
        searchPlaceholder="Buscar times (ex: name:DevOps)"
        searchContext="teams"
        userId={session?.user?._id?.toString()}
        onRowClick={(team: unknown) => setSelectedTeam(team as ITeam)}
      />

      <TeamDrawer
        team={selectedTeam}
        onClose={() => {
          setSelectedTeam(null);
          setRefreshKey(prev => prev + 1); // Força o refetch do grid
        }}
      />
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center">Carregando página de times...</div>}>
      <TeamsContent />
    </Suspense>
  );
}