// types/IObservationEvent.ts
import type { Document, Types } from "mongoose";
import type { ObservationResolvedReason } from "./IObservation";

/**
 * Ações registradas na timeline de uma observation. Cada tipo tem
 * origem e granularidade próprias:
 *
 * - `detected`  scan cria a observation pela primeira vez. Agrupado por pattern.
 * - `reopened`  scan detecta observation que estava `resolved` — regressão. Agrupado por pattern.
 * - `resolved`  scan confirma ausência (auto) ou usuário resolve. Agrupado por pattern em scan; individual em ação manual.
 * - `wont_fix`  decisão do usuário. Individual.
 * - `expired`   decisão do usuário. Individual.
 * - `assigned`  atribuição/mudança de responsável. Individual.
 * - `note`      nota livre (markdown/plaintext). Individual.
 */
export type ObservationEventType =
  | "detected"
  | "reopened"
  | "resolved"
  | "wont_fix"
  | "expired"
  | "assigned"
  | "note";

export type ObservationEventActorType = "scan" | "user" | "system";

/**
 * Motivo de um evento de transição. Combina os motivos de resolução
 * (`ObservationResolvedReason`) com os específicos de ação de usuário
 * e regressão.
 */
export type ObservationEventReason =
  | ObservationResolvedReason
  | "user-action"
  | "regression";

export interface ObservationEventActor {
  type: ObservationEventActorType;
  /** Presente quando `type="scan"`. Referência à "release" que disparou. */
  scanId?: Types.ObjectId;
  /** Presente quando `type="user"`. */
  userId?: Types.ObjectId;
  /** Nome desnormalizado para renderização sem populate. */
  displayName?: string;
}

export interface ObservationEventMetadata {
  /** Nº de observations afetadas (para eventos de scan agregados). */
  observationCount?: number;
  /** Amostra de até 5 paths afetados. */
  files?: string[];
  /** Status antes/depois — auditoria de transição. */
  previousStatus?: string;
  newStatus?: string;
  /** Nome do usuário anterior (para eventos `assigned`). */
  previousAssignee?: string | null;
  /** Nome do novo usuário (para eventos `assigned`). */
  newAssignee?: string | null;
}

export interface IObservationEvent extends Document {
  tenantId: Types.ObjectId;
  type: ObservationEventType;
  at: Date;
  actor: ObservationEventActor;

  /**
   * Observations afetadas. 1 em ações de usuário; N em eventos
   * disparados por scan (agrupados por patternId + ação).
   */
  observationIds: Types.ObjectId[];

  /** Padrão associado — usado para agrupar no feed. */
  patternId?: Types.ObjectId;
  patternName?: string;

  /** Motivo quando `type ∈ {resolved, reopened, wont_fix, expired}`. */
  reason?: ObservationEventReason;

  /** Texto da nota quando `type="note"`. */
  note?: string;

  metadata?: ObservationEventMetadata;
}
