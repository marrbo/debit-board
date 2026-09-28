// app/settings/admin/KeycloakExportPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  Loader2,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { useFeedback } from "@/hooks/useFeedback";
import HeaderActions from "@/components/PageHeader/HeaderActions";

interface RealmSummary {
  realm: string;
  users: number;
  clients: number;
  groups: number;
  roles: number;
}

/**
 * Painel de export do realm Keycloak. Duas ações:
 *
 *  - **Online** (REST API): sem downtime, sem senhas. Ação padrão.
 *  - **Offline** (sidecar): com senhas, requer downtime do Keycloak
 *    por ~10-30s. Requer confirmação explícita.
 */
export default function KeycloakExportPanel() {
  const confirm = useConfirm();
  const { toast } = useFeedback();

  const [summary, setSummary] = useState<RealmSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exportingOnline, setExportingOnline] = useState(false);
  const [exportingOffline, setExportingOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/keycloak/export", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setSummary(json as RealmSummary | null))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, []);

  const downloadFile = useCallback(async (url: string, defaultName: string) => {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = defaultName;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }, []);

  const handleExportOnline = useCallback(async () => {
    setExportingOnline(true);
    setError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadFile(
        "/api/admin/keycloak/export",
        `realm-${summary?.realm ?? "realm"}-${date}.json`,
      );
      toast.success("Realm exportado (sem senhas).");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast.error(msg);
    } finally {
      setExportingOnline(false);
    }
  }, [downloadFile, summary?.realm, toast]);

  const handleExportOffline = useCallback(async () => {
    const ok = await confirm({
      title: "Export offline com senhas",
      message:
        "O Keycloak ficará indisponível por 10 a 30 segundos durante o " +
        "export. Nenhum usuário conseguirá autenticar nesse intervalo.\n\n" +
        "Este export inclui hashes de senha dos usuários.\n\n" +
        "Deseja continuar?",
      confirmLabel: "Iniciar export",
      confirmColor: "warning",
    });
    if (!ok) return;

    setExportingOffline(true);
    setError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await downloadFile(
        "/api/admin/keycloak/export-offline",
        `realm-${summary?.realm ?? "realm"}-full-${date}.json`,
      );
      toast.success("Realm exportado (com senhas).");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast.error(msg);
    } finally {
      setExportingOffline(false);
    }
  }, [confirm, downloadFile, summary?.realm, toast]);

  const anyBusy = exportingOnline || exportingOffline;

  return (
    <section className="card p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-brand/10 shrink-0">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-heading">
              Export do realm Keycloak
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Backup completo da configuração de autenticação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <HeaderActions
            onClick={handleExportOnline}
            disabled={anyBusy || loadingSummary}
            tooltip="Export online (sem senhas)"
            color="brand"
            badge={
              exportingOnline ? (
                <Loader2 className="w-3 h-3 animate-spin absolute -top-0.5 -right-0.5 text-brand" />
              ) : null
            }
          >
            <Download />
          </HeaderActions>

          <HeaderActions
            onClick={handleExportOffline}
            disabled={anyBusy || loadingSummary}
            tooltip="Export offline (com senhas, causa downtime)"
            color="warning"
            badge={
              exportingOffline ? (
                <Loader2 className="w-3 h-3 animate-spin absolute -top-0.5 -right-0.5 text-warning" />
              ) : null
            }
          >
            <Server />
          </HeaderActions>
        </div>
      </header>

      {loadingSummary ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Lendo dados do realm…
        </div>
      ) : summary ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { k: "Usuários", v: summary.users },
            { k: "Clients", v: summary.clients },
            { k: "Grupos", v: summary.groups },
            { k: "Roles", v: summary.roles },
          ].map(({ k, v }) => (
            <div key={k} className="p-2 rounded-md bg-sunken">
              <dt className="text-muted uppercase tracking-wider text-[10px]">
                {k}
              </dt>
              <dd className="text-heading font-mono font-semibold mt-0.5">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="text-xs text-muted space-y-1">
          <p className="italic">Não foi possível ler o resumo do realm.</p>
          <p>
            Verifique as permissões do service account em{" "}
            <code className="font-mono text-[10px] bg-sunken px-1 rounded">
              /api/admin/keycloak/diagnose
            </code>
            .
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-muted leading-relaxed pt-2 border-t border-default">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning" />
        <p>
          <strong className="text-heading">Online</strong> não inclui senhas —
          os usuários deverão redefinir no primeiro login após o import.{" "}
          <strong className="text-heading">Offline</strong> inclui hashes e
          exige parar o Keycloak brevemente.
        </p>
      </div>

      {error && (
        <p className="text-xs text-error bg-error/10 border border-error/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}
