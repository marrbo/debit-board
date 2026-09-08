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
import { CirclePlus, UsersIcon } from "lucide-react";

const columns: Column<ITeam>[] = [
  { key: "name", label: "Nome do Time", sortable: true },
  { key: "description", label: "Descrição", sortable: true },
  {
    key: "projectCount",
    label: "Projetos",
    sortable: true,
    align: 'center',
    width: '100px',
    headerClassName: 'items-center text-center',
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
        className="inline-flex items-center gap-2 bg-page dark:bg-surface border border-default dark:border-strong text-heading dark:text-heading hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
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

  // Estados para busca simples (client-side)
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  if (status === "loading") return <div className="py-10 text-center">Carregando...</div>;
  if (!session) {
    router.push("/login");
    return null;
  }

  // Callback da busca simples
  const handleSimpleSearch = (column: string | null, value: string) => {
    setFilterColumn(column);
    setFilterValue(value);
    // Reset para a primeira página é feito pelo DataTable via useEffect? Não, precisa controlar aqui? 
    // O DataTable já não renderiza busca, então resetamos a página manualmente? Vamos deixar o DataTable lidar com isso via filterValue (client-side).
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Times"
        icon={<UsersIcon className="w-10 h-10 text-brand" />}
        subtitle="Gerencie os times. Times possuem projetos vinculados."
        actions={
          <button
            onClick={() => setSelectedTeam({} as ITeam)}
            className="flex items-center gap-2 bg-brand hover:bg-brand/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
          >
            <CirclePlus className="w-4 h-4"/> Novo Time
          </button>
        }
        search={{
          type: 'simple',
          onSearch: handleSimpleSearch,
          userId: session?.user?._id?.toString(),
          columns: columns.map(c => ({ key: c.key, label: c.label })),
          placeholder: 'Filtrar times...',
        }}
      />

      <DataTable
        key={refreshKey}
        endpoint="/api/teams?includeGlobal=false"
        columns={columns}
        defaultSort={{ field: "name", order: "asc" }}
        defaultLimit={8}
        pdfTitle="Times"
        // Remove searchContext e searchPlaceholder
        
        onRowClick={(team: unknown) => setSelectedTeam(team as ITeam)}
        // 🔥 Novas props para busca simples externa
        filterColumn={filterColumn}
        filterValue={filterValue}
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