// app/settings/projects/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, ListTree } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';

interface Project {
  _id: string;
  name: string;
  teamIds: string[];
  createdAt: string;
}

interface Repository {
  _id: string;
  projectId: string;
  name: string;
}

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, repoRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/repository'),
      ]);
      if (projRes.ok) setProjects(await projRes.json());
      if (repoRes.ok) setRepos(await repoRes.json());
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/azure/sync', { method: 'POST' });
      if (res.ok) {
        alert('Sincronização concluída com sucesso!');
        await fetchData();
      } else {
        const err = await res.json();
        alert('Erro na sincronização: ' + (err.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('Erro de rede ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  if (status === 'loading') return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;
  if (!session) { router.push('/login'); return null; }

  const repoCountMap = useMemo(() => {
    const map = new Map<string, number>();
    repos.forEach(repo => {
      map.set(repo.projectId, (map.get(repo.projectId) || 0) + 1);
    });
    return map;
  }, [repos]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    return projects.filter(proj => {
      const parts = searchQuery.split(' ');
      return parts.every(part => {
        if (part.includes(':')) {
          const [key, value] = part.split(':');
          if (key === 'name') return proj.name.toLowerCase().includes(value.toLowerCase());
          if (key === 'teamIds') return proj.teamIds.some(id => id.toLowerCase().includes(value.toLowerCase()));
          return true;
        }
        return proj.name.toLowerCase().includes(part);
      });
    });
  }, [projects, searchQuery]);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Projetos"
        subtitle="Gerencie os projetos do Tenant. Projetos possuem repositórios vinculados."
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
          </div>
        }
        searchBar={
          <DBQLAdvancedSearch 
            onSearch={setSearchQuery} 
            userId={session.user.id || ''}
            context="projects" 
            placeholder="Buscar projetos (ex: name:Portal)" />
        }
      />

      {loading ? (
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark shadow-sm">
          {projects.length === 0 
            ? 'Nenhum projeto encontrado. Clique em "Sincronizar" para buscar no Azure.' 
            : 'Nenhum projeto corresponde ao filtro.'}
        </div>
      ) : (
        <div className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-tertiary-light dark:text-apple-tertiary-dark border-b border-apple-border-light dark:border-apple-border-dark">
              <tr>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 text-center font-medium">Repositórios Vinculados</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
              {filteredProjects.map(project => {
                const count = repoCountMap.get(project._id) || 0;
                return (
                  <tr key={project._id} className="bg-apple-card-light dark:bg-apple-card-dark hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-colors">
                    <td className="p-4 font-medium text-apple-label-light dark:text-apple-label-dark flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-apple-blue/10 flex items-center justify-center text-[10px] text-apple-blue font-bold">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      {project.name}
                    </td>
                    <td className="p-4 text-center text-apple-secondary-light dark:text-apple-secondary-dark text-lg font-semibold">
                      {count}
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        href={`/settings/repositories?projectId=${project._id}`}
                        className="inline-flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
                      >
                        <ListTree className="w-3.5 h-3.5" /> Ver Repositórios
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}