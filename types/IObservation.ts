// types/IObservation.ts
import type { Document, Types } from "mongoose";
import type { IVulnerabilityPattern } from "./IVulnerabilityPattern";

export type ObservationSeverity = "low" | "medium" | "high" | "critical";

export type ObservationStatus = "open" | "resolved" | "wont_fix" | "expired";

/**
 * Motivo da **última** resolução. Preservado quando a observation é
 * reaberta (`resolved → open`) para não perder o histórico do ciclo
 * anterior.
 *
 * - `scan-not-found`   primeira ausência, sem ciclo anterior — confiança baixa.
 * - `auto-resolved`    já teve ciclo prévio (`recurrenceCount > 0`) — o padrão
 *                      prova que consegue sumir; ausência atual é confiável.
 * - `duplicate-merged` resolvida por merge de duplicata (migração/scan).
 * - `manual`           decisão do usuário.
 */
export type ObservationResolvedReason =
  | "scan-not-found"
  | "auto-resolved"
  | "duplicate-merged"
  | "manual";

export interface ObservationHit {
  charOffset: number;
  length: number;
}

export type IObservation = Document & {
  tenantId: Types.ObjectId;
  scanId: Types.ObjectId;
  patternId: Types.ObjectId;

  /**
   * Enriquecidos pelo handler `/api/observations` em tempo de resposta
   * (via `.populate()` + merge in-memory). Não persistem no banco.
   */
  pattern?: Partial<IVulnerabilityPattern> | null;
  patternName?: string;
  description?: string;
  recommendation?: string;

  query: string;
  category: string;
  fileName: string;
  filePath: string;
  project: string;
  repository: string;
  branch: string;
  hitCount: number;
  severity: ObservationSeverity;
  slaHours: number;

  /**
   * Ciclo de vida atual. `open` cobre tanto primeira detecção quanto
   * regressão (ver `reopenedAt`); `resolved`/`wont_fix`/`expired` são
   * decisões de saída. Não há estado `recurring` — a informação de
   * regressão vive em `reopenedAt` + `recurrenceCount`, ortogonal ao
   * status.
   */
  status: ObservationStatus;
  firstSeen: Date;
  lastSeen: Date;

  /**
   * Última resolução. **Não é limpo** quando a observation é reaberta —
   * combinado com `reopenedAt`, forma a timeline `resolved ⇄ open`.
   */
  resolvedAt?: Date;
  resolvedReason?: ObservationResolvedReason;

  /**
   * Última reabertura (`resolved → open`). `undefined` se nunca regrediu.
   */
  reopenedAt?: Date;

  /**
   * Nº de ciclos `resolved → open` desde `firstSeen`. `0` = nunca
   * regrediu. Alimenta o discriminador `auto-resolved`.
   */
  recurrenceCount: number;

  slaDueAt: Date;
  assignedTo?: string;
  snippet?: string;
  lineNumber?: number;
  hits?: ObservationHit[];
};
