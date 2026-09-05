"use client";

import { useState, useEffect } from "react";
import type { ITeam } from "@/types/ITeam";

interface BulkAssignTeamModalProps {
  projectIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkAssignTeamModal({ projectIds, onClose, onSuccess }: BulkAssignTeamModalProps) {
  const [teams, setTeams] = useState<ITeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    fetch("/api/teams")
      .then(res => res.json())
      .then(json => setTeams(json.data || []));
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/bulk-assign-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIds,
          teamId: selectedTeamId || undefined,
          newTeamName: creatingNew ? newTeamName : undefined,
          description
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao atribuir projetos");
      }
    } catch {
      alert("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md bg-white dark:bg-apple-card-dark p-6 rounded-2xl shadow-xl">
        <h2 className="text-xl font-bold mb-4">Atribuir {projectIds.length} projeto(s) a um Time</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!creatingNew}
                onChange={() => setCreatingNew(false)}
                className="w-4 h-4"
              />
              Time existente
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={creatingNew}
                onChange={() => setCreatingNew(true)}
                className="w-4 h-4"
              />
              Criar novo time
            </label>
          </div>

          {!creatingNew ? (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Selecione um time...</option>
              {teams.map(team => (
                <option key={team._id.toString()} value={team._id.toString()}>{team.name}</option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Nome do novo time"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={loading || (!creatingNew && !selectedTeamId) || (creatingNew && !newTeamName)}
              className="px-4 py-2 rounded-lg bg-apple-blue text-white disabled:opacity-50"
            >
              {loading ? "Atribuindo..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}