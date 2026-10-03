// components/ObservationActivityTab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Send,
  Shield,
  User,
} from "lucide-react";
import type {
  IObservationEvent,
  ObservationEventType,
} from "@/types/IObservationEvent";

const PAGE_SIZE = 20;
const MAX_NOTE_LENGTH = 2000;

const TYPE_META: Record<
  ObservationEventType,
  { icon: typeof Shield; label: string; tone: string }
> = {
  detected: {
    icon: Shield,
    label: "Detectado",
    tone: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  },
  reopened: {
    icon: AlertTriangle,
    label: "Reaberto (regressão)",
    tone: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  },
  resolved: {
    icon: CheckCircle2,
    label: "Resolvido",
    tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  wont_fix: {
    icon: Ban,
    label: "Não corrigir",
    tone: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  },
  expired: {
    icon: Clock,
    label: "Expirado",
    tone: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  },
  assigned: {
    icon: User,
    label: "Atribuído",
    tone: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  },
  note: {
    icon: Pencil,
    label: "Nota",
    tone: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  },
};

const REASON_LABEL: Record<string, string> = {
  "scan-not-found": "scan não encontrou",
  "auto-resolved": "confirmação em novo scan",
  "duplicate-merged": "duplicata fundida",
  manual: "ação manual",
  "user-action": "ação manual",
  regression: "regressão confirmada",
};

function formatRelative(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d atrás`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mês(es) atrás`;
  return `${Math.floor(mo / 12)} ano(s) atrás`;
}

export interface ObservationActivityTabProps {
  observationId: string;
}

export default function ObservationActivityTab({
  observationId,
}: ObservationActivityTabProps) {
  const [events, setEvents] = useState<IObservationEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (before: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) params.set("before", before);

      const res = await fetch(
        `/api/observations/${observationId}/events?${params}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao carregar timeline.");
      }
      return res.json() as Promise<{
        events: IObservationEvent[];
        nextBefore: string | null;
      }>;
    },
    [observationId],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPage(null);
        if (cancelled) return;
        setEvents(data.events);
        setNextBefore(data.nextBefore);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextBefore);
      setEvents((prev) => [...prev, ...data.events]);
      setNextBefore(data.nextBefore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmitNote = async () => {
    const trimmed = note.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/observations/${observationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar nota.");
      }
      const created = (await res.json()) as IObservationEvent;
      setEvents((prev) => [created, ...prev]);
      setNote("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Input de nota — padrão Aikido */}
      <div className="space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Deixe uma nota em texto simples, sem HTML"
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          disabled={submitting}
          className="w-full bg-[#0f1318] border border-gray-800 rounded-lg p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 resize-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            {note.length}/{MAX_NOTE_LENGTH}
          </span>
          <button
            type="button"
            onClick={handleSubmitNote}
            disabled={!note.trim() || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Adicionar nota
          </button>
        </div>
        {noteError && <p className="text-xs text-red-400">{noteError}</p>}
      </div>

      <div className="border-t border-gray-800 pt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando timeline…
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 py-6">{error}</div>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400 py-6">
            Nenhum evento registrado para esta observação.
          </p>
        ) : (
          <div className="space-y-3">
            <ol className="relative space-y-3">
              {events.map((event) => (
                <EventItem key={event._id.toString()} event={event} />
              ))}
            </ol>

            {nextBefore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full text-xs text-gray-400 hover:text-gray-200 py-2 border border-gray-800 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
                  </span>
                ) : (
                  "Carregar mais"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventItem({ event }: { event: IObservationEvent }) {
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  const count = event.metadata?.observationCount ?? 1;
  const isAggregate = count > 1;

  const actorLabel =
    event.actor.type === "scan"
      ? `scan ${event.actor.displayName ?? "—"}`
      : event.actor.type === "user"
        ? (event.actor.displayName ?? "usuário")
        : "sistema";

  return (
    <li className="flex gap-3">
      <div
        className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${meta.tone}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${meta.tone.split(" ")[0]}`}>
            {meta.label}
          </span>
          {isAggregate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">
              {count} arquivos
            </span>
          )}
          {event.reason && REASON_LABEL[event.reason] && (
            <span className="text-[10px] text-gray-500">
              · {REASON_LABEL[event.reason]}
            </span>
          )}
        </div>

        {event.patternName && (
          <p className="text-sm text-white truncate mt-0.5">
            {event.patternName}
          </p>
        )}

        {event.note && (
          <p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap">
            {event.note}
          </p>
        )}

        {event.metadata?.files && event.metadata.files.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {event.metadata.files.map((f) => (
              <li
                key={f}
                className="text-[10px] text-gray-500 font-mono truncate"
              >
                {f}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-gray-500 mt-1">
          Por {actorLabel} · {formatRelative(event.at)}
        </p>
      </div>
    </li>
  );
}
