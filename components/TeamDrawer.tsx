// components/TeamDrawer.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  X,
  Search,
  FolderGit2,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import type { IProject } from "@/types/IProject";
import type { ITeam } from "@/types/ITeam";
import { useConfirm } from "@/hooks/useConfirm";

interface TeamDrawerProps {
  team: ITeam | null;
  onClose: () => void;
}

export default function TeamDrawer({ team, onClose }: TeamDrawerProps) {
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
  const confirm = useConfirm();

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
  const [deleting, setDeleting] = useState(false);

  const isEditing = team && team._id ? true : false;
  const currentTeamId = team?._id?.toString();
  const canDelete = session?.user?.isAdmin === true;

  useEffect(() => {
    const userId = session?.user?.sub || session?.user?._id;
    if (userId) {
      fetch(`/api/projects?all=true&limit=1000`)
        .then((res) => res.json())
        .then((json) => setProjects(json.data || []))
        .catch((err) => console.error("Erro ao buscar projetos:", err));
    }
  }, [session]);

  const availableProjects = useMemo(() => {
    return projects.filter((p) => {
      const isInCurrentTeam = projectIds.includes(p._id.toString());
      if (isInCurrentTeam) return false;
      if (p.teamId && p.teamId.toString() !== currentTeamId) return false;
      if (p.isActive === false) return false;
      return true;
    });
  }, [projects, projectIds, currentTeamId]);

  const associatedProjects = projects.filter((p) =>
    projectIds.includes(p._id.toString()),
  );

  const filteredAvailable = availableProjects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const [selectAll, setSelectAll] = useState(false);
  useEffect(() => {
    const allSelected =
      filteredAvailable.length > 0 &&
      filteredAvailable.every((p) => projectIds.includes(p._id.toString()));
    setSelectAll(allSelected);
  }, [filteredAvailable, projectIds]);

  const toggleSelectAll = () => {
    if (selectAll) {
      setProjectIds((prev) =>
        prev.filter(
          (id) => !filteredAvailable.some((p) => p._id.toString() === id),
        ),
      );
    } else {
      const newIds = filteredAvailable.map((p) => p._id.toString());
      setProjectIds((prev) => [...new Set([...prev, ...newIds])]);
    }
  };

  const toggleProject = (id: string) => {
    setProjectIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        isEditing ? `/api/teams/${team._id}` : "/api/teams",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, projectIds }),
        },
      );

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

  const handleDeleteClick = async () => {
    if (!team?._id) return;

    const ok = await confirm({
      title: "Excluir time?",
      message: `O time "${team.name}" será removido permanentemente.\nSe houver projetos vinculados, a exclusão será bloqueada.\nEsta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      confirmColor: "error",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/teams?id=${team._id.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        alert(
          data.error ||
            "O time possui projetos vinculados e não pode ser excluído.",
        );
        return;
      }

      if (!res.ok) {
        alert(data.error || "Erro ao excluir time.");
        return;
      }

      // Sucesso — fecha o drawer (o parent dispara o refresh via onClose)
      onClose();
    } catch {
      alert("Erro de rede ao excluir.");
    } finally {
      setDeleting(false);
    }
  };

  const isBusy = saving || deleting;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md bg-white dark:bg-surface p-6 shadow-xl overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? "Editar Time" : "Criar Time"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
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
            <label className="block text-sm font-medium">
              Projetos associados ({associatedProjects.length})
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mt-1">
              {associatedProjects.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  Nenhum projeto associado.
                </div>
              ) : (
                associatedProjects.map((project) => (
                  <div
                    key={project._id.toString()}
                    className="flex items-center justify-between p-2 border-b border-gray-100"
                  >
                    <span className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-muted" />
                      <span>{project.name}</span>
                      {project.isActive === false && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                          Inativo
                        </span>
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
            <label className="block text-sm font-medium">
              Adicionar projetos
            </label>
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

            {filteredAvailable.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 mt-2 text-sm text-brand hover:underline"
              >
                {selectAll ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectAll ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            )}

            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg mt-2">
              {filteredAvailable.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {availableProjects.length === 0
                    ? "Nenhum projeto disponível para adicionar."
                    : "Nenhum resultado encontrado."}
                </div>
              ) : (
                filteredAvailable.map((project) => (
                  <div
                    key={project._id.toString()}
                    className="flex items-center gap-2 p-2 border-b border-gray-100"
                  >
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

          {/* Footer — Excluir à esquerda, Cancelar + Salvar à direita */}
          <div className="flex items-center justify-between gap-2 pt-4">
            <div>
              {isEditing && canDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={isBusy}
                  className="flex btn-cancel transition-colors"
                  title="Excluir time"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isBusy || !name}
                className="btn-primary"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
