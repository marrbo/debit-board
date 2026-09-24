import type { IVulnerabilityPattern } from "@/models/VulnerabilityPattern";
import type { Document, Types } from "mongoose";

export type ObservationSeverity = "low" | "medium" | "high" | "critical";

export type ObservationStatus =
  | "open"
  | "resolved"
  | "recurring"
  | "wont_fix"
  | "expired";

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
  status: ObservationStatus;
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt?: Date;
  slaDueAt: Date;
  assignedTo?: string;
  snippet?: string;
  lineNumber?: number;
  hits?: ObservationHit[];
};