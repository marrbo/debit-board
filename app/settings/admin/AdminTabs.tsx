"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, X, Contact, Settings } from "lucide-react";
import {
  createTenant,
  updateTenant,
  deleteTenant,
  assignUsersToTenant,
  updateUser,
  toggleTenantStatus,
  toggleUserStatus,
  createUser,
} from "./actions";
import type mongoose from "mongoose";
import { useConfirm } from "@/hooks/useConfirm";

export default function AdminTabs({
  tenants,
  users,
}: {
  tenants: any[];
  users: any[];
}) {
  // ✅ Hook chamado UMA vez, no topo do componente
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");

  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterPending, setFilterPending] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkTargetTenant, setBulkTargetTenant] = useState<string>();
  const [loading, setLoading] = useState(false);

  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const tenantMatch =
        filterTenant === "all" || user.tenantId === filterTenant;
      const pendingMatch = filterPending ? user.tenantId === "pending" : true;
      return tenantMatch && pendingMatch;
    });
  }, [users, filterTenant, filterPending]);

  const handleBulkAssign = async () => {
    if (selectedUsers.length === 0 || !bulkTargetTenant) return;

    const ok = await confirm({
      title: "Atribuir usuários",
      message: `Atribuir ${selectedUsers.length} usuário(s) ao tenant selecionado?`,
      confirmLabel: "Atribuir",
      confirmColor: "primary",
    });
    if (!ok) return;

    setLoading(true);
    try {
      await assignUsersToTenant(selectedUsers, bulkTargetTenant);
      setSelectedUsers([]);
      setBulkTargetTenant("");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (id: string) => {
    const ok = await confirm({
      title: "Deletar tenant",
      message: "Deletar este tenant?\nEssa ação é irreversível.",
      confirmLabel: "Deletar",
      confirmColor: "error",
    });
    if (!ok) return;

    try {
      await deleteTenant(id);
    } catch (e: any) {
      await confirm({
        title: "Erro ao deletar",
        message: e?.message ?? "Erro desconhecido.",
        confirmLabel: "OK",
        cancelLabel: "Fechar",
        confirmColor: "error",
      });
    }
  };

  const handleToggleTenant = async (
    id: mongoose.Types.ObjectId,
    currentStatus: boolean | undefined,
  ) => {
    const isActive = currentStatus ?? true;

    const ok = await confirm({
      title: isActive ? "Desativar tenant" : "Ativar tenant",
      message: `Deseja ${isActive ? "desativar" : "ativar"} este tenant?`,
      confirmLabel: isActive ? "Desativar" : "Ativar",
      confirmColor: isActive ? "warning" : "success",
      action: async () => {
        await toggleTenantStatus(id, !isActive);
      },
    });
    if (!ok) return;
  };

  const handleToggleUser = async (
    sub: string,
    currentStatus: boolean | undefined,
  ) => {
    const isActive = currentStatus ?? true;

    const ok = await confirm({
      title: isActive ? "Desativar usuário" : "Ativar usuário",
      message: `Deseja ${isActive ? "desativar" : "ativar"} este usuário?`,
      confirmLabel: isActive ? "Desativar" : "Ativar",
      confirmColor: isActive ? "warning" : "success",
      action: async () => {
        await toggleUserStatus(sub, !isActive);
      },
    });
    if (!ok) return;
  };

  const handleImpersonate = async (sub: string) => {
    const ok = await confirm({
      title: "Impersonar usuário",
      message:
        "Deseja se passar por este usuário em uma nova janela?\nA sessão de impersonação dura 15 minutos.",
      confirmLabel: "Impersonar",
      confirmColor: "primary",
    });
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: sub }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (e: any) {
      await confirm({
        title: "Erro ao impersonar",
        message: e?.message ?? "Erro desconhecido.",
        confirmLabel: "OK",
        cancelLabel: "Fechar",
        confirmColor: "error",
      });
    }
  };

  return (
    <div className="p-6">
      {/* Navegação por Abas */}
      <div className="flex border-b border-default dark:border-strong bg-surface/50 dark:bg-surface/50 rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 ${
            activeTab === "tenants"
              ? "border-b-2 border-brand text-brand bg-brand/5"
              : "text-muted dark:text-muted hover:text-heading dark:hover:text-heading"
          }`}
        >
          Tenants
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-6 py-3 text-sm font-medium transition-all duration-200 ${
            activeTab === "users"
              ? "border-b-2 border-brand text-brand bg-brand/5"
              : "text-muted dark:text-muted hover:text-heading dark:hover:text-heading"
          }`}
        >
          Usuários
        </button>
      </div>

      {/* -- ABA TENANTS -- */}
      {activeTab === "tenants" && (
        <div className="pt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-heading dark:text-heading">
              Gerenciar Tenants
            </h3>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-apple-green hover:bg-apple-green/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
            >
              <Plus className="w-4 h-4" /> Novo Tenant
            </button>
          </div>
          <div className="overflow-x-auto border border-default dark:border-strong rounded-lg shadow-sm hover:drop-shadow-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-muted dark:text-muted border-b border-default dark:border-strong">
                <tr>
                  <th className="p-4">Empresa</th>
                  <th className="p-4">UUID</th>
                  <th className="p-4">Domínio</th>
                  <th className="p-4 text-center">Ativo</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
                {tenants.map((t) => {
                  const isActive = t.isActive ?? true;
                  return (
                    <tr
                      key={t._id}
                      className="hover:bg-page dark:hover:bg-surface/80 transition-colors"
                    >
                      <td className="p-4 font-medium text-heading dark:text-heading">
                        {t.name}
                      </td>
                      <td className="p-4 font-mono text-muted dark:text-muted text-xs">
                        {t.uuid}
                      </td>
                      <td className="p-4 font-mono text-muted dark:text-muted">
                        {t.dominio || "-"}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleTenant(t._id, isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-apple-green/20 text-success border border-apple-green/30"
                              : "bg-apple-red/20 text-error border border-apple-red/30"
                          }`}
                        >
                          {isActive ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <Link
                          href={`/settings/admin/tenants/${t.uuid}/azure-settings`}
                          className="text-brand hover:text-brand/80 transition-colors"
                          title="Configurações do Azure"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>

                        <button
                          onClick={() => setEditingTenant(t)}
                          className="text-brand hover:text-brand/80 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t._id)}
                          className="text-error hover:text-error/80 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- ABA USUÁRIOS -- */}
      {activeTab === "users" && (
        <div className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="text-xs text-body dark:text-body uppercase tracking-wider font-semibold">
                  Filtrar por Tenant
                </label>
                <select
                  value={filterTenant}
                  onChange={(e) => setFilterTenant(e.target.value)}
                  className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-3 py-2 text-sm text-heading dark:text-heading w-48 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                >
                  <option value="all">Todos</option>
                  <option value="pending">⏳ Pendentes</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-body dark:text-body cursor-pointer pt-2 md:pt-5 transition-colors">
                <input
                  type="checkbox"
                  checked={filterPending}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setFilterPending(e.target.checked)}
                  className="w-4 h-4 bg-surface dark:bg-surface border-default dark:border-strong rounded focus:ring-2 focus:ring-brand transition-colors"
                />
                Apenas Pendentes
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 bg-brand hover:bg-brand/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
              >
                <Plus className="w-4 h-4" /> Novo Usuário
              </button>

              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-brand/10 p-3 rounded-lg border border-default dark:border-strong transition-colors">
                  <span className="text-sm text-brand">
                    {selectedUsers.length} selecionado(s)
                  </span>
                  <select
                    value={bulkTargetTenant?.toString() ?? ""}
                    onChange={(e) => setBulkTargetTenant(e.target.value)}
                    className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-2 py-1 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                  >
                    <option value="">Atribuir ao Tenant...</option>
                    {tenants.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkAssign}
                    disabled={!bulkTargetTenant || loading}
                    className="bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                  >
                    {loading ? "Processando..." : "Aplicar"}
                  </button>
                  <button
                    onClick={() => setSelectedUsers([])}
                    className="text-muted dark:text-muted hover:text-heading dark:hover:text-heading transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border border-default dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 text-muted dark:text-muted border-b border-default dark:border-strong">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedUsers.length === filteredUsers.length &&
                        filteredUsers.length > 0
                      }
                      onChange={(e) =>
                        setSelectedUsers(
                          e.target.checked
                            ? filteredUsers.map((u) => u.sub)
                            : [],
                        )
                      }
                      className="w-4 h-4 rounded bg-surface dark:bg-surface border-default dark:border-strong focus:ring-2 focus:ring-brand transition-colors"
                    />
                  </th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Tenant</th>
                  <th className="p-3 text-center">Onboard</th>
                  <th className="p-3 text-center">Ativo</th>
                  <th className="p-3 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
                {filteredUsers.map((u) => {
                  const isActive = u.isActive ?? true;
                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-page dark:hover:bg-surface/80 transition-colors"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.sub)}
                          onChange={(e) =>
                            setSelectedUsers(
                              e.target.checked
                                ? [...selectedUsers, u.sub]
                                : selectedUsers.filter((id) => id !== u.sub),
                            )
                          }
                          className="w-4 h-4 rounded bg-surface dark:bg-surface border-default dark:border-strong focus:ring-2 focus:ring-brand transition-colors"
                        />
                      </td>
                      <td className="p-3 text-heading dark:text-heading">
                        {u.name || "Sem Nome"}
                      </td>
                      <td className="p-3 text-body dark:text-body">
                        {u.email}
                      </td>
                      <td className="p-3 text-muted dark:text-muted">
                        {u.tenantId === "pending" ? (
                          <span className="text-warning text-xs font-bold">
                            Pendente
                          </span>
                        ) : (
                          tenants.find((t) => t._id === u.tenantId)?.name ||
                          u.tenantId
                        )}
                      </td>
                      <td className="p-3 text-center text-xs">
                        <span
                          className={`px-2 py-1 rounded-full border ${
                            u.onboardingCompleted
                              ? "bg-apple-green/20 text-success border-apple-green/30"
                              : "bg-apple-orange/20 text-warning border-apple-orange/30"
                          }`}
                        >
                          {u.onboardingCompleted ? "Concluído" : "Pendente"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleUser(u.sub, isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-apple-green/20 text-success border border-apple-green/30 hover:bg-apple-green/30"
                              : "bg-apple-red/20 text-error border border-apple-red/30 hover:bg-apple-red/30"
                          }`}
                        >
                          {isActive ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="p-3 text-right flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-brand hover:text-brand/80 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleImpersonate(u.sub)}
                          className="text-brand hover:text-brand/80 transition-colors"
                          title="Login como"
                        >
                          <Contact className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Modais -- */}
      {showCreate && (
        <TenantForm
          onClose={() => setShowCreate(false)}
          action={createTenant}
          title="Criar Novo Tenant"
        />
      )}
      {editingTenant && (
        <TenantForm
          onClose={() => setEditingTenant(null)}
          action={updateTenant.bind(null, editingTenant._id)}
          title="Editar Tenant"
          initialName={editingTenant.name}
          initialDomain={editingTenant.dominio || ""}
        />
      )}
      {editingUser && (
        <UserEditForm
          user={editingUser}
          tenants={tenants}
          onClose={() => setEditingUser(null)}
        />
      )}
      {showCreateUser && (
        <UserCreateForm
          onClose={() => setShowCreateUser(false)}
          tenants={tenants}
        />
      )}
    </div>
  );
}

// ============================================================
// COMPONENTES DOS MODAIS
// ============================================================

function TenantForm({
  onClose,
  action,
  title,
  initialName = "",
  initialDomain = "",
}: {
  onClose: () => void;
  action: (formData: FormData) => Promise<void>;
  title: string;
  initialName?: string;
  initialDomain?: string;
}) {
  return (
    <div className="fixed inset-0 bg-page/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg w-full max-w-md p-6 shadow-2xl transition-colors">
        <h2 className="text-lg font-bold text-heading dark:text-heading mb-4">
          {title}
        </h2>
        <form
          action={action}
          onSubmit={() => setTimeout(onClose, 200)}
          className="space-y-4"
        >
          <input
            type="text"
            name="name"
            defaultValue={initialName}
            placeholder="Nome da Empresa"
            className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
            required
          />
          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Domínio (ex: empresa.com.br)
            </label>
            <input
              type="text"
              name="dominio"
              defaultValue={initialDomain}
              placeholder="empresa.com.br"
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted dark:text-muted hover:text-heading dark:hover:text-heading transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-brand hover:bg-brand/80 text-white px-4 py-2 rounded-lg font-medium transition-all"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserEditForm({
  user,
  tenants,
  onClose,
}: {
  user: any;
  tenants: any[];
  onClose: () => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentTenant = user.tenantId === "pending" ? "pending" : user.tenantId;
  const confirm = useConfirm();

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);

    try {
      await updateUser(user.sub, formData);
      onClose();
    } catch (err: any) {
      await confirm({
        title: "Erro ao salvar",
        message:
          "Não foi possível salvar as alterações: " +
          (err.message || "Erro desconhecido"),
        confirmLabel: "OK",
        cancelLabel: "Fechar",
        confirmColor: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-page/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg w-full max-w-md p-6 shadow-2xl transition-colors">
        <h2 className="text-lg font-bold text-heading dark:text-heading mb-4">
          Editar Usuário
        </h2>
        <p className="text-xs text-muted dark:text-muted mb-4">
          Altere os dados ou force a conclusão do onboarding.
        </p>

        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Nome
            </label>
            <input
              type="text"
              name="name"
              defaultValue={user.name || ""}
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              defaultValue={user.email || ""}
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Vincular ao Tenant
            </label>
            <select
              name="tenantId"
              defaultValue={currentTenant}
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
            >
              <option value="pending">⏳ Pendente</option>
              {tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="onboardingCompleted"
              name="onboardingCompleted"
              value="true"
              defaultChecked={user.onboardingCompleted === true}
              className="w-4 h-4 bg-surface dark:bg-surface border border-default dark:border-strong rounded focus:ring-2 focus:ring-brand cursor-pointer transition-colors"
            />
            <label
              htmlFor="onboardingCompleted"
              className="text-sm text-body dark:text-body cursor-pointer select-none"
            >
              Onboarding concluído (Libera acesso ao Dashboard)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted dark:text-muted hover:text-heading dark:hover:text-heading transition-colors"
              disabled={isUpdating}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-all"
            >
              {isUpdating ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserCreateForm({
  onClose,
  tenants,
}: {
  onClose: () => void;
  tenants: any[];
}) {
  const [isCreating, setIsCreating] = useState(false);
  const confirm = useConfirm();

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createUser(formData);
      onClose();
    } catch (err: any) {
      await confirm({
        title: "Erro ao criar usuário",
        message: err.message || "Erro desconhecido",
        confirmLabel: "OK",
        cancelLabel: "Fechar",
        confirmColor: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-page/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg w-full max-w-md p-6 shadow-2xl transition-colors">
        <h2 className="text-lg font-bold text-heading dark:text-heading mb-4">
          Criar Novo Usuário
        </h2>
        <p className="text-xs text-muted dark:text-muted mb-4">
          Adicione um usuário manualmente para testar a impersonação.
        </p>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Nome (Opcional)
            </label>
            <input
              type="text"
              name="name"
              placeholder="João da Silva"
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              E-mail *
            </label>
            <input
              type="email"
              name="email"
              placeholder="joao@sefaz.ba.gov.br"
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">
              Vincular ao Tenant *
            </label>
            <select
              name="tenantId"
              className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              required
            >
              <option value="">Selecione um Tenant...</option>
              {tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-muted dark:text-muted hover:text-heading dark:hover:text-heading transition-colors"
              disabled={isCreating}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-all"
            >
              {isCreating ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
