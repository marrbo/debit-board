// lib/observation-events.ts
import type { Types } from "mongoose";
import { ObservationEvent } from "@/models/ObservationEvent";
import type {
  ObservationEventType,
  ObservationEventReason,
} from "@/types/IObservationEvent";

/** Máximo de paths guardados como amostra em um evento agregado. */
const FILE_SAMPLE_LIMIT = 5;

export interface ScanEventSource {
  type: "detected" | "reopened" | "resolved";
  observationId: Types.ObjectId;
  patternId: Types.ObjectId;
  patternName?: string;
  filePath?: string;
  /** Presente em `resolved` e `reopened`. */
  reason?: ObservationEventReason;
}

/**
 * Escreve eventos de um scan agrupados por (type, patternId, reason).
 * Um scan com 500 hits de 3 patterns gera no máximo ~9 eventos — o
 * feed do drawer fica legível e o índice multikey em `observationIds`
 * resolve as queries por observation sem custo.
 */
export async function recordScanEvents(params: {
  tenantId: Types.ObjectId;
  scanId: Types.ObjectId;
  scanDisplayName: string;
  at: Date;
  sources: ScanEventSource[];
}): Promise<void> {
  const { tenantId, scanId, scanDisplayName, at, sources } = params;
  if (sources.length === 0) return;

  const grouped = new Map<
    string,
    {
      type: ObservationEventType;
      patternId: Types.ObjectId;
      patternName?: string;
      reason?: ObservationEventReason;
      observationIds: Types.ObjectId[];
      files: string[];
    }
  >();

  for (const s of sources) {
    const key = `${s.type}|${s.patternId}|${s.reason ?? ""}`;
    const entry = grouped.get(key) ?? {
      type: s.type,
      patternId: s.patternId,
      patternName: s.patternName,
      reason: s.reason,
      observationIds: [],
      files: [],
    };
    entry.observationIds.push(s.observationId);
    if (s.filePath && entry.files.length < FILE_SAMPLE_LIMIT) {
      entry.files.push(s.filePath);
    }
    grouped.set(key, entry);
  }

  const docs = Array.from(grouped.values()).map((g) => ({
    tenantId,
    type: g.type,
    at,
    actor: { type: "scan" as const, scanId, displayName: scanDisplayName },
    observationIds: g.observationIds,
    patternId: g.patternId,
    patternName: g.patternName,
    reason: g.reason,
    metadata: {
      observationCount: g.observationIds.length,
      files: g.files,
    },
  }));

  await ObservationEvent.insertMany(docs);
}

/**
 * Escreve um evento individual (ação de usuário ou sistema).
 * Usado em PATCH de observation (status, assignee) e notas.
 */
export async function recordUserEvent(params: {
  tenantId: Types.ObjectId;
  observationId: Types.ObjectId;
  patternId?: Types.ObjectId;
  type: ObservationEventType;
  userId?: Types.ObjectId;
  displayName?: string;
  reason?: ObservationEventReason;
  note?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const {
    tenantId,
    observationId,
    patternId,
    type,
    userId,
    displayName,
    reason,
    note,
    metadata,
  } = params;

  await ObservationEvent.create({
    tenantId,
    type,
    at: new Date(),
    actor: {
      type: userId ? "user" : "system",
      userId,
      displayName,
    },
    observationIds: [observationId],
    patternId,
    reason,
    note,
    metadata,
  });
}
