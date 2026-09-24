"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  Upload,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  Server,
  Clock,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ConfirmPasswordDialog from "@/components/ConfirmPasswordDialog";
import { useFeedback } from "@/hooks/useFeedback";

// ============================================================
// Tipos
// ============================================================
interface ServerInfo {
  host: string;
  version: string;
  replicaSet: string | null;
  isPrimary: boolean;
  databases: number;
  collections: number;
  dbName: string;
}

interface ConnectionDescriptor {
  id: string;
  label: string;
  envVar: string;
  info: ServerInfo | null;
  error?: string;
}

interface DumpEntry {
  id: string;
  path: string;
  manifest: {
    version: number;
    dbName: string;
    createdAt: string;
    collections: { name: string; count: number }[];
  } | null;
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  source: "primary" | "atlas";
  retentionDays: number;
  lastRunAt?: string;
  lastRunStatus?: "success" | "failed";
  nextRunAt?: string;
}

// ============================================================
// Página
// ============================================================
export default function DbToolsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const [connections, setConnections] = useState<ConnectionDescriptor[]>([]);
  const [dumps, setDumps] = useState<DumpEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"dump" | "restore" | null>(null);

  const [dumpSource, setDumpSource] = useState("primary");
  const [restoreTarget, setRestoreTarget] = useState("primary");

  // Restore em duas etapas: seleciona o dump → confirma senha
  const [pendingRestore, setPendingRestore] = useState<DumpEntry | null>(null);

  // ============================================================
  // Guard
  // ============================================================
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (!session.user.isAdmin) router.push("/settings");
  }, [session, status, router]);

  // ============================================================
  // Fetch
  // ============================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, dumpsRes] = await Promise.all([
        fetch("/api/admin/db-tools/connections", { cache: "no-store" }),
        fetch("/api/admin/db-tools", { cache: "no-store" }),
      ]);

      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections);
      }
      if (dumpsRes.ok) {
        const data = await dumpsRes.json();
        setDumps(data.dumps);
        setSchedule(data.schedule ?? null);
      }
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;

    const timeoutId = window.setTimeout(() => {
      void fetchAll();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [session, fetchAll]);

  // ============================================================
  // Dump manual
  // ============================================================
  const handleDump = async () => {
    const src = connections.find((c) => c.id === dumpSource);
    if (!src?.info) {
      toast.error("Fonte indisponível");
      return;
    }

    const label = `${src.id}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const ok = await confirm({
      title: "Criar backup?",
      message: `Origem: ${src.label} (${src.info.dbName} em ${src.info.host}).`,
      confirmLabel: "Criar",
    });
    if (!ok) return;

    setBusy("dump");
    try {
      const res = await fetch("/api/admin/db-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dump", label, source: dumpSource }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Falha no backup");
        return;
      }
      toast.success("Backup concluído.");
      fetchAll();
    } catch {
      toast.error("Erro de rede");
    } finally {
      setBusy(null);
    }
  };

  // ============================================================
  // Restore — dispara o dialog de senha
  // ============================================================
  const openRestore = (entry: DumpEntry) => {
    setPendingRestore(entry);
  };

  const executeRestore = async (password: string) => {
    if (!pendingRestore) return;
    const target = connections.find((c) => c.id === restoreTarget);

    setBusy("restore");
    try {
      const res = await fetch("/api/admin/db-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          id: pendingRestore.id,
          target: target,
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha no restore");
      }

      toast.success("Restore concluído.", {
        description: `${data.totalDocuments} documentos · backup de segurança: ${data.safetyBackup}`,
      });
      setPendingRestore(null);
      fetchAll();
    } finally {
      setBusy(null);
    }
  };

  // ============================================================
  // Schedule
  // ============================================================
  const handleScheduleSave = async (next: ScheduleConfig) => {
    try {
      const res = await fetch("/api/admin/db-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", ...next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Falha ao salvar");
        return;
      }
      setSchedule(data.schedule);
      toast.success("Agendamento atualizado.");
    } catch {
      toast.error("Erro de rede");
    }
  };

  // ============================================================
  // Guards
  // ============================================================
  if (status === "loading") {
    return <div className="py-10 text-center text-muted">Carregando...</div>;
  }
  if (!session?.user?.isAdmin) return null;

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Backup & Restore"
        icon={<Database className="w-8 h-8 text-brand" />}
        subtitle="Exporte, restaure e agende backups entre Atlas e o servidor local."
      />

      <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-heading mb-1">
            Operações destrutivas
          </p>
          <p className="text-xs">
            Restore <strong>substitui</strong> todas as coleções do destino. Um
            backup de segurança é criado automaticamente antes.
          </p>
        </div>
      </div>

      {/* Servidores */}
      <section>
        <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" /> Servidores conectados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-lg border ${
                c.info
                  ? "bg-surface border-default dark:border-strong"
                  : "bg-error/5 border-error/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-heading">
                  {c.label}
                </span>
                <span className="text-[10px] font-mono text-muted">
                  {c.envVar}
                </span>
              </div>
              {c.info ? (
                <dl className="text-xs space-y-1">
                  <Row label="Host" value={c.info.host} mono />
                  <Row label="Database" value={c.info.dbName} mono />
                  <Row
                    label="Replica set"
                    value={c.info.replicaSet ?? "standalone"}
                    mono
                  />
                  <Row
                    label="Primary"
                    value={c.info.isPrimary ? "sim" : "não"}
                  />
                  <Row label="Databases" value={String(c.info.databases)} />
                  <Row label="Collections" value={String(c.info.collections)} />
                </dl>
              ) : (
                <p className="text-xs text-error">{c.error}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Dump */}
      <section className="p-5 bg-surface border border-default dark:border-strong rounded-lg">
        <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-brand" /> Criar backup
        </h2>
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <label className="flex-1">
            <span className="block text-xs text-muted mb-1">Origem</span>
            <select
              value={dumpSource}
              onChange={(e) => setDumpSource(e.target.value)}
              className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.info}>
                  {c.label}
                  {c.info ? ` — ${c.info.dbName}` : " (indisponível)"}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleDump}
            disabled={
              busy !== null ||
              !connections.find((c) => c.id === dumpSource)?.info
            }
            className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {busy === "dump" ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Criar backup
          </button>
        </div>
      </section>

      {/* Schedule */}
      {schedule && (
        <ScheduleForm
          key={JSON.stringify(schedule)}
          schedule={schedule}
          onSave={handleScheduleSave}
        />
      )}

      {/* Dumps */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider">
            Backups disponíveis
          </h2>
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted">Destino do restore</span>
            <select
              value={restoreTarget}
              onChange={(e) => setRestoreTarget(e.target.value)}
              className="bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-1.5 text-sm"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.info}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted">
            <LoaderCircle className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : dumps.length === 0 ? (
          <div className="p-8 text-center text-muted border border-dashed border-default rounded-lg">
            Nenhum backup criado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {dumps.map((entry) => {
              const total =
                entry.manifest?.collections.reduce((a, c) => a + c.count, 0) ??
                0;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 p-4 bg-surface border border-default dark:border-strong rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-heading font-mono truncate">
                        {entry.id}
                      </p>
                      <p className="text-xs text-muted">
                        {entry.manifest
                          ? `${
                              entry.manifest.collections.length
                            } coleções · ${total} documentos · ${new Date(
                              entry.manifest.createdAt,
                            ).toLocaleString("pt-BR")}`
                          : "Manifest ausente"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => openRestore(entry)}
                    disabled={busy !== null || !entry.manifest}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 shrink-0"
                  >
                    {busy === "restore" ? (
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Restaurar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Dialog de confirmação por senha */}
      <ConfirmPasswordDialog
        open={pendingRestore !== null}
        title="Confirmação por senha"
        description={
          pendingRestore
            ? `Restaurar "${pendingRestore.id}" em "${connections.find(
                (c) => c.id === restoreTarget,
              )?.label}". Isto substitui os dados atuais do destino.`
            : ""
        }
        onCancel={() => setPendingRestore(null)}
        onConfirm={executeRestore}
      />
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================
function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono" : ""}>{value}</dd>
    </div>
  );
}

function ScheduleForm({
  schedule,
  onSave,
}: {
  schedule: ScheduleConfig;
  onSave: (s: ScheduleConfig) => void;
}) {
  const [draft, setDraft] = useState(schedule);

  return (
    <section className="p-5 bg-surface border border-default dark:border-strong rounded-lg">
      <h2 className="text-sm font-bold text-heading mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-brand" /> Agendamento
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-xs font-medium">Ativar</span>
        </label>

        <label>
          <span className="block text-xs text-muted mb-1">Frequência</span>
          <select
            value={draft.frequency}
            onChange={(e) =>
              setDraft({
                ...draft,
                frequency: e.target.value as ScheduleConfig["frequency"],
              })
            }
            className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
          >
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </label>

        <label>
          <span className="block text-xs text-muted mb-1">Horário (UTC)</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={draft.hour}
              onChange={(e) =>
                setDraft({ ...draft, hour: Number(e.target.value) })
              }
              className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              max={59}
              value={draft.minute}
              onChange={(e) =>
                setDraft({ ...draft, minute: Number(e.target.value) })
              }
              className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </label>

        <label>
          <span className="block text-xs text-muted mb-1">Origem</span>
          <select
            value={draft.source}
            onChange={(e) =>
              setDraft({
                ...draft,
                source: e.target.value as "primary" | "atlas",
              })
            }
            className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
          >
            <option value="primary">Servidor atual</option>
            <option value="atlas">Atlas</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <label>
          <span className="block text-xs text-muted mb-1">Retenção (dias)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={draft.retentionDays}
            onChange={(e) =>
              setDraft({ ...draft, retentionDays: Number(e.target.value) })
            }
            className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2 flex justify-between items-end gap-3">
          <p className="text-xs text-muted">
            {schedule.lastRunAt && (
              <>
                Último: {new Date(schedule.lastRunAt).toLocaleString("pt-BR")}{" "}
                {schedule.lastRunStatus === "success" ? "✅" : "❌"}
              </>
            )}
            {schedule.nextRunAt && (
              <>
                <br />
                Próximo: {new Date(schedule.nextRunAt).toLocaleString("pt-BR")}
              </>
            )}
          </p>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90"
          >
            Salvar agendamento
          </button>
        </div>
      </div>
    </section>
  );
}
