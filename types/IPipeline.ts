// types/IPipeline.ts
import type { Document } from 'mongoose';

export interface IPipeline extends Document {
  tenantId: string;
  repositoryId: string; // referência ao _id do Repository
  name: string;
  type: 'yaml' | 'classic'; // tipo de pipeline
  azureDefinitionId: number; // ID da definição no Azure
  url: string; // URL da definição
  lastBuildStatus?: string; // 'succeeded', 'failed', 'inProgress', etc.
  lastBuildDate?: Date;
  buildCount: number; // total de builds (considerando últimos X dias)
  failedBuildCount: number;
  syncDate: Date;
  createdAt: Date;
}