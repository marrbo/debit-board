// app/settings/teams/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Users } from 'lucide-react';

export default function TeamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const teamsRes = await fetch('/api/teams');
    if (teamsRes.ok) setTeams(await teamsRes.json());

    const usersRes = await fetch('/api/users');
    if (usersRes.ok) setUsers(await usersRes.json());
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/login');
    fetchData();
  }, [session, status, router]);

  const createTeam = async () => {
    if (!newTeamName) return;
    await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName }),
    });
    setNewTeamName('');
    fetchData();
  };

  const deleteTeam = async (id: string) => {
    if (!confirm('Deletar este time?')) return;
    await fetch(`/api/teams?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updateTeamMembers = async (teamId: string, userId: string, action: 'add' | 'remove') => {
    await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    });
    fetchData();
  };

  if (status === 'loading') return <div className="text-apple-tertiary-light dark:text-apple-tertiary-dark py-10">Carregando times...</div>;

  return (
    <div className="space-y-6 w-full mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark">
            <Users className="w-5 h-5 inline-block mr-2" />
            Repositórios
        </h1>
      </div>

      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-4 border-b border-apple-border-light dark:border-apple-border-dark pb-4">
          <h2 className="text-lg font-semibold text-apple-label-light dark:text-apple-label-dark">Gerenciar Repositórios</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Nome do Repositório"
              className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl px-3 py-1.5 text-sm text-apple-label-light dark:text-apple-label-dark focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-colors"
            />
            <button
              onClick={createTeam}
              className="flex items-center gap-2 bg-apple-blue hover:bg-apple-blue/80 text-white px-3 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Criar Repositório
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team._id} className="flex flex-col bg-apple-card-light/50 dark:bg-apple-card-dark/50 border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-apple-label-light dark:text-apple-label-dark font-bold text-lg">{team.name}</h3>
                </div>
                <button onClick={() => deleteTeam(team._id)} className="text-apple-red hover:text-apple-red/80 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-apple-border-light dark:border-apple-border-dark">
                {team.members?.map((sub: string) => {
                  const u = users.find((x) => x.sub === sub);
                  return u ? (
                    <span key={u.sub} className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-apple-secondary-light dark:text-apple-secondary-dark px-2 py-0.5 rounded-full text-xs flex items-center gap-2 border border-apple-border-light dark:border-apple-border-dark">
                      {u.name || u.email}
                      <button onClick={() => updateTeamMembers(team._id, u.sub, 'remove')} className="text-apple-tertiary-light dark:text-apple-tertiary-dark hover:text-apple-red transition-colors">×</button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}