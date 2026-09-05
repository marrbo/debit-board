// models/Pipeline.ts
import type { IPipeline } from '@/types/IPipeline';
import type { Model } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

const PipelineSchema = new Schema<IPipeline>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  repositoryId: { type: String, required: true, ref: 'Repository' },
  name: { type: String, required: true },
  type: { type: String, enum: ['yaml', 'classic'], required: true },
  azureDefinitionId: { type: Number, required: true },
  url: { type: String, required: true },
  lastBuildStatus: { type: String },
  lastBuildDate: { type: Date },
  buildCount: { type: Number, default: 0 },
  failedBuildCount: { type: Number, default: 0 },
  syncDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Índices
PipelineSchema.index({ tenantId: 1, azureDefinitionId: 1 }, { unique: true });
PipelineSchema.index({ repositoryId: 1 });

export const Pipeline: Model<IPipeline> = mongoose.models.Pipeline || mongoose.model<IPipeline>('Pipeline', PipelineSchema);