// types/IProject.ts
import type { TeamProject } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import type mongoose from 'mongoose';
import type { Document } from 'mongoose';

export interface IProject extends TeamProject, Document {
  tenantId: string;
  teamId: mongoose.Types.ObjectId,
  azureProjectId: string;
  syncDate: Date;
  repositoryCount: number;
  createdAt: Date;
  pipelineCount: number;
  pipelineFailedCount: number;
  pipelineClassicCount: number;
  pipelineYamlCount: number;
  pipelineSuccessCount: number;
}
