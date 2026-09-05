"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { IProject } from "@/types/IProject";
import type { ITeam } from "@/types/ITeam";

interface TeamDrawerProps {
  team: ITeam | null;
  onClose: () => void;
}

export default function TeamDrawer({ team, onClose }: TeamDrawerProps) {
  // 🔥 CORREÇÃO: Se o team for null, não renderiza nada (fecha o drawer)
  if (!team) return null;

  return (
    <TeamDrawerForm
      key={team?._id?.toString() ?? "new"}
      team={team}
      onClose={onClose}
    />
  );
}

function TeamDrawerForm({ team, onClose }: TeamDrawerProps) {
  const { data: session } = useSession();
  const [name, setName] = useState(() => team?.name || "");
  const [description, setDescription] = useState(() => team?.description || "");
  const [projectIds, setProjectIds] = useState<string[]>(
    () => team?.projectIds?.map((p: any) => p.toString()) || []
  );
  const [projects, setProjects] = useState<IProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = team && team._id ? true : false;

  useEffect(() => {
    if (session?.user?._id) {
      fetch(`/api/projects?available=true`)
        .then(res => res.json())
        .then((json) => setProjects(json.data || []))
        .catch(console.error);
    }
  }, [session]);

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
        onClose(); // Fecha o drawer imediatamente
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

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md bg-white dark:bg-apple-card-dark p-6 shadow-xl overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? "Editar Time" : "Criar Time"}
        </h2>

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

          <div>
            <label className="block text-sm font-medium">Projetos disponíveis</label>
            <input
              type="text"
              placeholder="Buscar projeto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
            />
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredProjects.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {projects.length === 0 ? "Nenhum projeto disponível." : "Nenhum projeto encontrado."}
                </div>
              ) : (
                filteredProjects.map((project) => (
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