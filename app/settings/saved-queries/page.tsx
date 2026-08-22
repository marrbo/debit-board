// app/settings/saved-queries/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bookmark, Trash2, Edit3, Plus, Play, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DBQLRichInput from '@/components/dbql/DBQLRichInput';

interface SavedQueryItem {
  _id: string;
  name: string;
  queryString: string;
  context: string;
  visibility: 'private' | 'shared' | 'public' | 'temporary';
  createdAt: string;
}

export default function SavedQueriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [queries, setQueries] = useState<SavedQueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [queryString, setQueryString] = useState('');
  const [context, setContext] = useState('issues');
  const [visibility, setVisibility] = useState<SavedQueryItem['visibility']>('private');

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/saved-queries');
      if (res.ok) { 
        let data = await res.json();
        data = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        data = data.filter((q: any) => q.visibility !== 'temporary');
        setQueries(data);
      }
    } catch (err) {
      console.error('Erro ao carregar consultas salvas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchQueries();
    }
  }, [status]);

  if (status === 'loading') return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;
  if (!session) { router.push('/login'); return null; }

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setQueryString('');
    setContext('issues');
    setVisibility('private');
    setIsModalOpen(true);
  };

  function getVisibilityLabel(visibility: string): string {
    const map: Record<string, string> = {
      public: 'Pública',
      shared: 'Compartilhada',
      private: 'Privada',
    };
    return map[visibility] || 'Temporária';
  }

  const handleOpenEdit = (q: SavedQueryItem) => {
    setEditingId(q._id);
    setName(q.name);
    setQueryString(q.queryString);
    setContext(q.context || 'issues');
    setVisibility(q.visibility || 'private');
    setIsModalOpen(true);
  };

  const handleVisibilityChange = (value: string) => {
    const validVisibilities: SavedQueryItem['visibility'][] = ['private', 'shared', 'public', 'temporary'];
    if (validVisibilities.includes(value as any)) {
        setVisibility(value as SavedQueryItem['visibility']);
    }
 };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !queryString) return;

    try {
        console.log('Payload enviado:', { 
        name, queryString, context, visibility, tenantId: session.user.tenantId 
        });

      const url = '/api/saved-queries';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? { id: editingId, tenantId: session.user.tenantId, name, queryString, context, visibility } 
        : { name, tenantId: session.user.tenantId, queryString, context, visibility };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsModalOpen(false);
        await fetchQueries();
      } else {
        const err = await res.json();
        alert('Erro ao salvar: ' + (err.error || 'Erro desconhecido'));
      }
    } catch (err) {
      alert('Erro de rede.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta consulta salva?')) return;
    try {
      const res = await fetch(`/api/saved-queries?id=${id}`, { method: 'DELETE' });
      if (res.ok) await fetchQueries();
    } catch (err) {
      alert('Erro ao deletar.');
    }
  };

  const handleRunQuery = (q: SavedQueryItem) => {
    let targetPath = '/observations';
    if (q.context === 'projects') targetPath = '/settings/projects';
    else if (q.context === 'repositories') targetPath = '/settings/repositories';
    else if (q.context === 'stats') targetPath = '/settings/stats';

    router.push(`${targetPath}?q=${q._id}&m=a`);
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Consultas Salvas"
        subtitle="Gerencie seus filtros e consultas DBQL favoritos para acesso rápido em todo o sistema."
        actions={
          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Consulta
          </button>
        }
      />

      {loading ? (
        <div className="py-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>
      ) : queries.length === 0 ? (
        <div className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark shadow-sm">
          Nenhuma consulta salva encontrada. Crie uma nova consulta ou salve direto pela barra de pesquisa avançada.
        </div>
      ) : (
        <div className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-tertiary-light dark:text-apple-tertiary-dark border-b border-apple-border-light dark:border-apple-border-dark">
              <tr>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Contexto</th>
                <th className="p-4 font-medium">Visibilidade</th>
                <th className="p-4 font-medium">Query DBQL</th>
                <th className="p-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
              {queries.map(q => (
                <tr key={q._id} className="bg-apple-card-light dark:bg-apple-card-dark hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-colors">
                  <td className="p-4 font-medium text-apple-label-light dark:text-apple-label-dark flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-apple-blue/10 flex items-center justify-center text-apple-blue">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    {q.name}
                  </td>
                  <td className="p-4 text-apple-secondary-light dark:text-apple-secondary-dark uppercase text-xs font-light">
                    <span className="bg-apple-hover dark:bg-[#2C2C2E] px-1 py-1 rounded-md border border-apple-border-light dark:border-apple-border-dark">
                      {q.context}
                    </span>
                  </td>
                  <td className="p-4 text-apple-secondary-light dark:text-apple-secondary-dark text-xs">
                    {getVisibilityLabel(q.visibility)}
                  </td>
                  <td className="p-4 font-mono text-xs text-apple-secondary-light/45 italic monospace dark:text-apple-secondary-dark max-w-md truncate">
                    {q.queryString}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                      onClick={() => handleRunQuery(q)}
                      title="Executar Consulta"
                      className="inline-flex items-center gap-1.5 border border-apple-blue text-apple-blue px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-blue/30"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span className="hidden focus:inline">Executar</span>
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(q)}
                      title="Editar"
                      className="inline-flex items-center gap-1.5 border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-tertiary-light/30"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden focus:inline">Editar</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(q._id)}
                      title="Excluir"
                      className="inline-flex items-center gap-1.5 border border-apple-red text-apple-red px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-red/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden focus:inline">Excluir</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar / Editar Consulta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white dark:bg-apple-card-dark rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 border border-apple-border-light dark:border-apple-border-dark">
            <div className="flex justify-between items-center border-b border-apple-border-light dark:border-apple-border-dark pb-3">
              <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">
                {editingId ? 'Editar Consulta Salva' : 'Nova Consulta Salva'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-apple-tertiary-light hover:text-apple-label-light">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Nome</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: Minha Busca Crítica" 
                required 
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Contexto</label>
                <select 
                  value={context} 
                  onChange={(e) => setContext(e.target.value)} 
                  className="w-full"
                >
                  <option value="issues">Issues</option>
                  <option value="projects">Projetos</option>
                  <option value="repositories">Repositórios</option>
                  <option value="stats">Estatísticas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Visibilidade</label>
                <select 
                  value={visibility} 
                  onChange={(e) => handleVisibilityChange(e.target.value)} 
                  className="w-full"
                >
                  <option value="private">Privada (Apenas você)</option>
                  <option value="shared">Compartilhada (Equipe)</option>
                  <option value="public">Pública</option>
                  <option value="temporary">Temporária</option>
                </select>
              </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Query DBQL</label>
                <DBQLRichInput
                    value={queryString}
                    onChange={setQueryString}
                    placeholder='Ex: category:"Broken Access Control" AND severity:critical'
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-apple-border-light dark:border-apple-border-dark">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-apple-hover dark:bg-apple-border-dark text-apple-label-light dark:text-apple-label-dark"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 rounded-xl text-sm font-medium bg-apple-blue text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}