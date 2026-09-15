"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { X, UserPlus, LoaderCircle, Search } from "lucide-react";
import type { IUser } from "@/types/IUser";

interface BulkAssignAssigneeModalProps {
  observationIds: string[];
  users: IUser[];
  onClose: () => void;
  onSuccess: () => void;
}

const getAvatarUrl = (user?: IUser) => {
  if (user?.avatar) return user.avatar;
  const name = user?.name || "U";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&length=2&background=0D8ABC&color=fff&width=32&height=32`;
};

export default function BulkAssignAssigneeModal({
  observationIds,
  users,
  onClose,
  onSuccess,
}: BulkAssignAssigneeModalProps) {
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/observations/bulk-assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observationIds,
          assignedTo: selectedSub,
        }),
      });

      if (!res.ok) {
        alert("Erro ao atribuir responsável");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      alert("Erro de rede ao atribuir responsável");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-default dark:border-strong rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-default dark:border-strong">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-sm font-bold text-heading">
                Atribuir Responsável
              </h2>
              <p className="text-[11px] text-muted">
                {observationIds.length} observation
                {observationIds.length > 1 ? "s" : ""} selecionada
                {observationIds.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-muted hover:text-error transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-default dark:border-strong">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuários..."
              className="w-full pl-9 pr-3 py-2 bg-page dark:bg-sunken border border-default dark:border-strong rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">
              Nenhum usuário encontrado.
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selectedSub === user.sub;
              return (
                <button
                  key={user.sub}
                  type="button"
                  onClick={() => setSelectedSub(user.sub)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors disabled:opacity-50 ${
                    isSelected
                      ? "bg-brand/10 ring-1 ring-brand/30"
                      : "hover:bg-apple-tertiary-light/10"
                  }`}
                >
                  <Image
                    src={getAvatarUrl(user)}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                    alt={user.name || user.email || "User"}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium text-heading truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-muted truncate">
                      {user.email}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-brand shrink-0" />
                  )}
                </button>
              );
            })
          )}

          <button
            type="button"
            onClick={() => setSelectedSub(null)}
            disabled={saving}
            className={`w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              selectedSub === null
                ? "bg-error/10 text-error ring-1 ring-error/30"
                : "text-muted hover:bg-error/5 hover:text-error"
            }`}
          >
            Limpar responsável
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-default dark:border-strong">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:text-heading transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Aplicando..." : `Aplicar a ${observationIds.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}