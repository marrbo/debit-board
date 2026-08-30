// app/settings/repositories/page.tsx
'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';

interface Repository {
  _id: string;
  name: string;
  projectId: string;
  createdAt: string;
}

// 🔥 NÃO remova esse componente. O Suspense no Next.js exige que o useSearchParams() esteja dentro de um componente filho.
function RepositoriesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/repository');
      if (res.ok) {
        setRepos(await res.json());
      }
    } catch (err) {
      console.error(err);
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
        alert('Sincronização concluída!');
        await fetchRepos();
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
      fetchRepos();
    }
  }, [status]);

  if (status === 'loading') return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;
  if (!session) { router.push('/login'); return null; }

  // Filtro local DBQL e também por projectId
  const filteredRepos = useMemo(() => {
    let filtered = repos;
    if (projectId) {
      filtered = filtered.filter(repo => repo.projectId === projectId);
    }

    if (!searchQuery.trim()) return filtered;

    return filtered.filter(repo => {
      const parts = searchQuery.split(' ');
      
      return parts.every(part => {
        if (part.includes(':')) {
          const [key, value] = part.split(':');
          let searchValue = value.toLowerCase();
          let fieldValue = '';

          if (key === 'name') fieldValue = repo.name.toLowerCase();
          if (key === 'projectId') fieldValue = repo.projectId.toLowerCase();

          if (searchValue.includes('*')) {
            const regexStr = searchValue.replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexStr}$`, 'i');
            return regex.test(fieldValue);
          }

          return fieldValue.includes(searchValue);
        }
        return repo.name.toLowerCase().includes(part);
      });
    });
  }, [repos, projectId, searchQuery]);

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={projectId ? 'Repositórios do Projeto' : 'Repositórios do Tenant'}
        subtitle={projectId ? 'Lista de repositórios pertencentes a este projeto.' : 'Gerencie os repositórios sincronizados automaticamente pelas buscas.'}
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
        searchBar={
          <DBQLAdvancedSearch 
            onSearch={setSearchQuery} 
            userId={session.user.id || ''}
            context="repositories" 
            placeholder="Buscar repositórios (ex: name:repo-backend OR projectId:..." />
        }
      />

      <div className="relative mb-4" />

      {loading ? (
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>
      ) : filteredRepos.length === 0 ? (
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark shadow-sm">
          {repos.length === 0 
            ? 'Nenhum repositório encontrado. Execute uma sincronização manual para buscar do Azure.' 
            : 'Nenhum repositório corresponde ao filtro ou ao projeto selecionado.'}
        </div>
      ) : (
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden w-full shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-tertiary-light dark:text-apple-tertiary-dark border-b border-apple-border-light dark:border-apple-border-dark">
              <tr>
                <th className="p-4 font-medium">Nome do Repositório</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
              {filteredRepos.map(repo => (
                <tr key={repo._id} className="bg-apple-card-light dark:bg-apple-card-dark hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-colors">
                  <td className="p-4 font-medium text-apple-label-light dark:text-apple-label-dark flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-apple-orange/10 flex items-center justify-center text-[10px] text-apple-orange font-bold">
                      {repo.name.charAt(0).toUpperCase()}
                    </div>
                    {repo.name}
                  </td>
                  <td className="p-4 text-right text-apple-tertiary-light dark:text-apple-tertiary-dark text-xs">
                    Em breve: Configuração SAST
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 🔥 PÁGINA PRINCIPAL COM O SUSPENSE ENVOLVENDO A LÓGICA QUE USA SEARCH PARAMS
export default function RepositoriesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando página de repositórios...</div>}>
      <RepositoriesContent />
    </Suspense>
  );
}