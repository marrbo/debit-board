// types/ISASTScan.ts
import type { Document, Types } from "mongoose";

export type SASTScanStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Origem de execução do scan. Determina qual motor encontrou os
 * findings e alimenta o filtro por ferramenta na listagem.
 */
export type SASTScanOrigin =
  | "azure-search-code"
  | "sonarqube"
  | "trivy"
  | "dependency-track"
  | "snyk";

export interface ISASTScanSummaryEntry {
  azureCollection: string;
  project: string;
  repository: string;
  occurrences: number;
}

export interface ISASTScan extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;

  /**
   * Identificador estável do Debit-Board. Formato `SCAN-YYYYMMDD-XXXXXX`.
   * Único por tenant. Ordenável lexicograficamente por data.
   */
  scanId: string;

  /**
   * Motor que executou o scan. Hoje sempre `azure-search-code`; será
   * populado com outros valores quando as integrações Trivy/SonarQube/
   * DependencyTrack entrarem.
   */
  origin: SASTScanOrigin;

  scanDate: Date;
  completedAt?: Date;

  status: SASTScanStatus;

  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;

  /** Score 0–100. Recalculado ao final do scan. */
  riskScore: number;
  riskBand: "minimal" | "low" | "moderate" | "high" | "critical";

  /** Perfil de scan usado. `null` = "Default" (todos os patterns ativos). */
  profileId?: Types.ObjectId;
  profileName?: string;

  /** Preenchido quando este scan foi um re-run. */
  rerunOfScanId?: Types.ObjectId;

  /** Duração em ms (`completedAt - scanDate`). */
  durationMs?: number;

  /** Mensagem de erro em scans falhos. */
  errorMessage?: string;

  summary: ISASTScanSummaryEntry[];
}
