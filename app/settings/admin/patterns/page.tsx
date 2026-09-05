'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';

export default function PatternsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPattern, setEditingPattern] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', queryPattern: '', severity: 'medium', category: '', description: '', 
    recommendation: '', // 🔥 NOVO CAMPO
    slaHours: 72, externalId: '', externalLink: '', reference: '', enabled: true
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) router.push('/settings');
    fetchPatterns();
  }, [session, status, router]);

  const fetchPatterns = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/patterns');
    if (res.ok) setPatterns(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingPattern ? 'PUT' : 'POST';
    const url = editingPattern ? `/api/admin/patterns?id=${editingPattern._id}` : '/api/admin/patterns';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setEditingPattern(null); setShowCreate(false); setForm({
        name: '', queryPattern: '', severity: 'medium', category: '', description: '', 
        recommendation: '', // 🔥 RESET DO NOVO CAMPO
        slaHours: 72, externalId: '', externalLink: '', reference: '', enabled: true
      });
      fetchPatterns();
    } else alert('Erro ao salvar padrão.');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este padrão?')) return;
    await fetch(`/api/admin/patterns?id=${id}`, { method: 'DELETE' });
    fetchPatterns();
  };

  if (loading) return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark">SAST Patterns</h1>
        <button 
          onClick={() => { 
            setForm({ 
              name: '', queryPattern: '', severity: 'medium', category: '', description: '', 
              recommendation: '', // 🔥 RESET DO NOVO CAMPO
              slaHours: 72, externalId: '', externalLink: '', reference: '', enabled: true 
            }); 
            setShowCreate(true); 
          }} 
          className="flex items-center gap-2 bg-apple-green hover:bg-apple-green/80 text-white px-4 py-2 rounded-2xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Padrão
        </button>
      </div>

      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-tertiary-light dark:text-apple-tertiary-dark border-b border-apple-border-light dark:border-apple-border-dark">
            <tr>
              <th className="p-4 font-medium">Nome</th><th className="p-4 font-medium">Categoria</th><th className="p-4 font-medium">Severidade</th>
              <th className="p-4 text-center font-medium">SLA (h)</th><th className="p-4 text-center font-medium">Ativo</th><th className="p-4 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
            {patterns.map(p => (
              <tr key={p._id} className="hover:bg-apple-bg-light dark:hover:bg-apple-card-dark/80 transition-colors">
                <td className="p-4 font-medium text-apple-label-light dark:text-apple-label-dark">{p.name}</td>
                <td className="p-4 text-apple-secondary-light dark:text-apple-secondary-dark">{p.category}</td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.severity === 'critical' ? 'bg-apple-red/20 text-apple-red' : p.severity === 'high' ? 'bg-apple-orange/20 text-apple-orange' : 'bg-apple-blue/20 text-apple-blue'}`}>{p.severity}</span></td>
                <td className="p-4 text-center text-apple-secondary-light dark:text-apple-secondary-dark">{p.slaHours}</td>
                <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${p.enabled ? 'bg-apple-green/20 text-apple-green' : 'bg-apple-tertiary-light/20 text-apple-tertiary-light'}`}>{p.enabled ? 'Sim' : 'Não'}</span></td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => { setEditingPattern(p); setForm(p); }} className="text-apple-blue hover:text-apple-blue/80"><Pencil className="w-4 h-4 inline" /></button>
                  <button onClick={() => handleDelete(p._id)} className="text-apple-red hover:text-apple-red/80"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação/Edição Apple */}
      {(showCreate || editingPattern) && (
        <div className="fixed inset-0 bg-apple-bg-dark/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
            <h2 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark mb-4">{editingPattern ? 'Editar Padrão' : 'Criar Novo Padrão'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Nome *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" required /></div>
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Query Pattern *</label><input type="text" value={form.queryPattern} onChange={e => setForm({...form, queryPattern: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Categoria</label><input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" /></div>
                <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Severidade</label><select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              </div>
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">SLA (horas)</label><input type="number" value={form.slaHours} onChange={e => setForm({...form, slaHours: parseInt(e.target.value)})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" /></div>
              
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Por que isso é um problema? (Descrição)</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" rows={2}></textarea></div>
              
              {/* 🔥 NOVO CAMPO: Como corrigir? (Recomendação) */}
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">Como corrigir? (Recomendação)</label><textarea value={form.recommendation} onChange={e => setForm({...form, recommendation: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" rows={3} placeholder="Ex: Utilize PreparedStatement, ORM, etc."></textarea></div>

              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">External ID (ex: CVE-2021-44228)</label><input type="text" value={form.externalId} onChange={e => setForm({...form, externalId: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" /></div>
              <div><label className="block text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark uppercase tracking-wider mb-1">External Link (URL)</label><input type="url" value={form.externalLink} onChange={e => setForm({...form, externalLink: e.target.value})} className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors" /></div>
              
              <div className="flex items-center gap-2"><input type="checkbox" id="enabled" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} className="w-4 h-4 rounded bg-apple-card-light dark:bg-apple-card-dark border-apple-border-light dark:border-apple-border-dark focus:ring-2 focus:ring-apple-blue/30" /><label htmlFor="enabled" className="text-sm text-apple-secondary-light dark:text-apple-secondary-dark">Ativo</label></div>
              
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setShowCreate(false); setEditingPattern(null); }} className="px-4 py-2 text-apple-tertiary-light dark:text-apple-tertiary-dark hover:text-apple-label-light dark:hover:text-apple-label-dark">Cancelar</button><button type="submit" className="bg-apple-blue hover:bg-apple-blue/80 text-white px-4 py-2 rounded-2xl font-medium transition-colors">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}