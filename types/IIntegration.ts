// types/IIntegration.ts
import type { Document, Types } from "mongoose";

export type IntegrationKind =
  | "scanner" // produz findings (SonarQube, Trivy)
  | "issue-tracker" // sincroniza status (Jira, GitHub Issues)
  | "vcs" // código-fonte (Azure DevOps, GitHub)
  | "notifier" // alertas (Slack, Teams, Email)
  | "siem" // exportação (Splunk, Datadog);
  | "webhook"; // receptor genérico

export type IntegrationTrigger =
  | "scheduled" // DB agenda
  | "webhook" // externo chama DB
  | "manual" // usuário dispara
  | "event"; // DB reage a mudança interna

export interface IntegrationCapabilities {
  triggers: IntegrationTrigger[];
  /** Recurso produzido — alimenta a UI e o roteamento. */
  produces: ("scan" | "finding" | "observation" | "event" | "notification")[];
  /** Recursos consumidos — alimenta o roteamento. */
  consumes: ("project" | "observation" | "sla-breach" | "scan-request")[];
}

export interface IntegrationManifest {
  /** Identificador único do manifesto — estável entre versões. */
  id: string;
  name: string;
  version: string; // semver
  vendor: string;
  homepage?: string;
  /** Prefixo para dbId de patterns importados — `SQ`, `TR`. */
  patternPrefix?: string;
  capabilities: IntegrationCapabilities;
  /** Schema declarativo dos settings — valida o que o usuário configura. */
  settingsSchema: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "secret" | "url";
      label: string;
      required?: boolean;
      default?: unknown;
    }
  >;
  /** Webhooks que este manifest pode receber. */
  webhookEvents?: string[]; // ex.: ["push", "pull_request.merged"]
}

export interface IIntegration extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  manifestId: string;
  manifest: IntegrationManifest;
  /** Configuração específica da instância. */
  settings: Record<string, unknown>;
  enabled: boolean;
  installedAt: Date;
  lastSyncAt?: Date;
  lastError?: string;
  /** Contadores de uso — telemetria local. */
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
  };
}
