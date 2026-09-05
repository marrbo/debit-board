// models/Repository.ts
import type { IRepository } from '@/types/IRepository';
import type { Model } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

const RepositorySchema = new Schema<IRepository>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  projectId: { type: String, required: true, ref: 'Project' },
  azureProjectId: { type: String, required: true },
  name: { type: String, required: true },
  azureRepoId: { type: String, required: true },
  url: { type: String, required: true },
  syncDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  buildCount: { type: Number, default: 0 },
  buildfailedCount: { type: Number, default: 0 },
  buildSucceededCount: { type: Number, default: 0 },
  pipelineCount: { type: Number, default: 0 },
  pipelineFailedCount: { type: Number, default: 0 },
  pipelineClassicCount: { type: Number, default: 0 },
  pipelineYamlCount: { type: Number, default: 0 },
});

// Índices para evitar duplicatas
RepositorySchema.index({ tenantId: 1, azureRepoId: 1 }, { unique: true });
RepositorySchema.index({ tenantId: 1, projectId: 1, name: 1 });

export const Repository: Model<IRepository> = mongoose.models.Repository || mongoose.model<IRepository>('Repository', RepositorySchema);