// app/settings/saved-queries/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bookmark, Trash2, Edit3, Plus, Play, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface SavedQueryItem {
  _id: string;
  name: string;
  queryString: string;
  context: string;
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

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/saved-queries');
      if (res.ok) setQueries(await res.json());
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: SavedQueryItem) => {
    setEditingId(q._id);
    setName(q.name);
    setQueryString(q.queryString);
    setContext(q.context || 'issues');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !queryString) return;

    try {
      const url = '/api/saved-queries';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, name, queryString, context } : { name, queryString, context };

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
    const targetPath = q.context !== 'issues' ? '/settings/{q.context}' : '/observations';
    router.push(`${targetPath}?q=${encodeURIComponent(q.queryString)}&mode=advanced`);
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
                  <td className="p-4 text-apple-secondary-light dark:text-apple-secondary-dark uppercase text-xs font-semibold">
                    <span className="bg-apple-hover dark:bg-[#2C2C2E] px-2 py-1 rounded-md border border-apple-border-light dark:border-apple-border-dark">
                      {q.context}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-apple-secondary-light dark:text-apple-secondary-dark max-w-md truncate">
                    {q.queryString}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                      onClick={() => handleRunQuery(q)}
                      title="Executar Consulta"
                      className="inline-flex items-center gap-1 bg-apple-blue/10 text-apple-blue hover:bg-apple-blue/20 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Executar
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(q)}
                      title="Editar"
                      className="inline-flex items-center gap-1 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(q._id)}
                      title="Excluir"
                      className="inline-flex items-center gap-1 bg-apple-red/10 text-apple-red hover:bg-apple-red/20 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
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
              <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Query DBQL</label>
              <textarea 
                value={queryString} 
                onChange={(e) => setQueryString(e.target.value)} 
                placeholder="Ex: category:'Broken Access Control' AND severity:critical" 
                required 
                rows={3}
                className="w-full"
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