// app/settings/profile/user/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company: '',
    jobTitle: '',
    phone: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/login');

    const fetchProfile = async () => {
      setLoading(true);
      const res = await fetch('/api/user/me');
      if (res.ok) {
        const data = await res.json();
        setForm({
          name: data.name || session?.user.name || '',
          company: data.company || '',
          jobTitle: data.jobTitle || '',
          phone: data.phone || '',
        });
      } else {
        setForm({
          name: session?.user.name || '',
          company: '',
          jobTitle: '',
          phone: '',
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/user/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      alert('Perfil atualizado com sucesso!');
    } else {
      const errorData = await res.json();
      alert('Erro ao salvar perfil: ' + (errorData.error || 'Erro desconhecido'));
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando perfil...</div>;

  return (
    <div className="w-full space-y-6 mx-auto">
      <PageHeader title="Profile" subtitle="Gerencie suas informações pessoais." />
      
      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm transition-colors">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apple-secondary-light dark:text-apple-secondary-dark mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apple-secondary-light dark:text-apple-secondary-dark mb-1">Empresa / Organização</label>
            <input 
              type="text" 
              value={form.company} 
              onChange={e => setForm({...form, company: e.target.value})} 
              className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30" 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-apple-secondary-light dark:text-apple-secondary-dark mb-1">Cargo</label>
              <input 
                type="text" 
                value={form.jobTitle} 
                onChange={e => setForm({...form, jobTitle: e.target.value})} 
                className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-apple-secondary-light dark:text-apple-secondary-dark mb-1">Telefone</label>
              <input 
                type="text" 
                value={form.phone} 
                onChange={e => setForm({...form, phone: e.target.value})} 
                className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-2 text-sm text-apple-label-light dark:text-apple-label-dark transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30" 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={saving} 
            className="bg-apple-blue hover:bg-apple-blue/90 text-white px-4 py-2 rounded-2xl font-medium mt-4 transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}