// components/TeamDrawer.tsx
'use client';

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { X, Search, FolderGit2, Trash2, CheckSquare, Square } from "lucide-react";
import type { IProject } from "@/types/IProject";
import type { ITeam } from "@/types/ITeam";

interface TeamDrawerProps {
  team: ITeam | null;
  onClose: () => void;
}

export default function TeamDrawer({ team, onClose }: TeamDrawerProps) {
  if (!team) return null;

  return <TeamDrawerForm key={team?._id?.toString() ?? "new"} team={team} onClose={onClose} />;
}

function TeamDrawerForm({ team, onClose }: TeamDrawerProps) {
  const { data: session } = useSession();
  const [name, setName] = useState(() => team?.name || "");
  const [description, setDescription] = useState(() => team?.description || "");
  const [projectIds, setProjectIds] = useState<string[]>(() => {
    if (!team?.projectIds) return [];
    const raw = team.projectIds as any;
    return raw.flat().map((p: any) => p.toString());
  });
  const [projects, setProjects] = useState<IProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = team && team._id ? true : false;
  const currentTeamId = team?._id?.toString();

  useEffect(() => {
    const userId = session?.user?.id || session?.user?._id;
    if (userId) {
      // Busca TODOS os projetos do tenant (sem paginação)
      fetch(`/api/projects?all=true&limit=1000`)
        .then(res => res.json())
        .then((json) => setProjects(json.data || []))
        .catch((err) => console.error("Erro ao buscar projetos:", err));
    }
  }, [session]);

  // Projetos que podem ser adicionados: 
  // 1. Não estão no time atual
  // 2. Não estão atribuídos a nenhum outro time (teamId nulo ou igual ao atual)
  // 3. Projetos inativos não aparecem para adicionar, mas se já estiverem no time, aparecem como associados
  const availableProjects = useMemo(() => {
    return projects.filter(p => {
      // Não está no time atual
      const isInCurrentTeam = projectIds.includes(p._id.toString());
      if (isInCurrentTeam) return false;
      
      // Se tem teamId definido e não é o time atual, está em outro time
      if (p.teamId && p.teamId.toString() !== currentTeamId) return false;
      
      // Projetos inativos não podem ser adicionados
      if (p.isActive === false) return false;
      
      return true;
    });
  }, [projects, projectIds, currentTeamId]);

  // Projetos associados (inclui inativos para manter histórico)
  const associatedProjects = projects.filter(p => projectIds.includes(p._id.toString()));

  const filteredAvailable = availableProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selecionar todos os filtrados
  const [selectAll, setSelectAll] = useState(false);
  useEffect(() => {
    // Se todos os filteredAvailable estiverem selecionados, marca selectAll
    const allSelected = filteredAvailable.length > 0 && filteredAvailable.every(p => projectIds.includes(p._id.toString()));
    setSelectAll(allSelected);
  }, [filteredAvailable, projectIds]);

  const toggleSelectAll = () => {
    if (selectAll) {
      // Desmarca todos os filteredAvailable
      setProjectIds(prev => prev.filter(id => !filteredAvailable.some(p => p._id.toString() === id)));
    } else {
      // Marca todos os filteredAvailable
      const newIds = filteredAvailable.map(p => p._id.toString());
      setProjectIds(prev => [...new Set([...prev, ...newIds])]);
    }
  };

  const toggleProject = (id: string) => {
    setProjectIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(isEditing ? `/api/teams/${team._id}` : "/api/teams", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, projectIds }),
      });

      if (res.ok) {
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao salvar time");
      }
    } catch (e) {
      alert("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md bg-white dark:bg-apple-card-dark p-6 shadow-xl overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{isEditing ? "Editar Time" : "Criar Time"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {/* Projetos associados */}
          <div>
            <label className="block text-sm font-medium">Projetos associados ({associatedProjects.length})</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mt-1">
              {associatedProjects.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Nenhum projeto associado.</div>
              ) : (
                associatedProjects.map(project => (
                  <div key={project._id.toString()} className="flex items-center justify-between p-2 border-b border-gray-100">
                    <span className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-apple-tertiary-light" />
                      <span>{project.name}</span>
                      {project.isActive === false && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Inativo</span>
                      )}
                    </span>
                    <button
                      onClick={() => toggleProject(project._id.toString())}
                      className="p-1 rounded hover:bg-red-50 text-red-500"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Adicionar projetos */}
          <div>
            <label className="block text-sm font-medium">Adicionar projetos</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2"
              />
            </div>
            
            {/* Checkbox selecionar todos (visível apenas quando há resultados filtrados) */}
            {filteredAvailable.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 mt-2 text-sm text-apple-blue hover:underline"
              >
                {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectAll ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            )}

            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mt-2">
              {filteredAvailable.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {availableProjects.length === 0 ? "Nenhum projeto disponível para adicionar." : "Nenhum resultado encontrado."}
                </div>
              ) : (
                filteredAvailable.map(project => (
                  <div key={project._id.toString()} className="flex items-center gap-2 p-2 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={projectIds.includes(project._id.toString())}
                      onChange={() => toggleProject(project._id.toString())}
                      className="w-4 h-4"
                    />
                    <span>{project.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name}
              className="px-4 py-2 rounded-lg bg-apple-blue text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}