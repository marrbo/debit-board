"use client";

import { useState } from "react";
import { ShieldAlert, LoaderCircle } from "lucide-react";

interface ConfirmPasswordDialogProps {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
}

export default function ConfirmPasswordDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: ConfirmPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onConfirm(password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na confirmação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-default dark:border-strong rounded-lg p-6 w-full max-w-md shadow-2xl space-y-4"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-warning shrink-0" />
          <div>
            <h2 className="text-base font-bold text-heading">{title}</h2>
            <p className="text-xs text-muted mt-1">{description}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
            Sua senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            disabled={busy}
            className="w-full bg-page dark:bg-sunken border border-default dark:border-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {error && (
          <p className="text-xs text-error bg-error/10 border border-error/30 rounded-lg p-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-muted hover:text-heading transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !password}
            className="px-4 py-2 rounded-lg bg-error text-white text-sm font-medium hover:bg-error/90 disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
