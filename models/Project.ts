// models/Project.ts
import type { IProject } from '@/types/IProject';
import mongoose, { type Model, Schema } from 'mongoose';

const ProjectSchema = new Schema<IProject>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  teamId: { type: mongoose.Types.ObjectId, ref: 'Team', default: null },
  azureProjectId: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String },
  defaultTeamImageUrl: { type: String },
  repositoryCount: { type: Number, default: 0 },
  syncDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  pipelineCount: { type: Number, default: 0 },
  pipelineFailedCount: { type: Number, default: 0 },
  pipelineClassicCount: { type: Number, default: 0 },
  pipelineYamlCount: { type: Number, default: 0 },
  pipelineSuccessCount: { type: Number, default: 0 },
});

ProjectSchema.index({ tenantId: 1, azureProjectId: 1 }, { unique: true });

export const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);