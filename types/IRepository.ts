// types/IRepository.ts
import type { GitRepository } from 'azure-devops-node-api/interfaces/GitInterfaces';
import type { Document } from 'mongoose';

export interface IRepository extends GitRepository, Document {
  tenantId: string;
  projectId: string; // Referência ao _id do Project (string)
  azureProjectId: string; // GUID do projeto no Azure (para referência direta)
  name: string; // Nome do repositório no Azure
  azureRepoId: string; // GUID do repositório no Azure
  url: string; // URL do repositório no Azure
  syncDate: Date; // Última data de sincronização
  createdAt: Date;

  buildCount?: number; // Total de builds (considerando últimos X dias)
  buildfailedCount?: number; // Total de builds com falha (considerando últimos X dias)
  buildSucceededCount?: number; // Total de builds bem-sucedidos (considerando últimos X dias)
  pipelineCount?: number; // Total de pipelines associadas a este repositório
  pipelineFailedCount?: number; // Total de pipelines com falha
  pipelineClassicCount?: number; // Total de pipelines clássicas
  pipelineYamlCount?: number; // Total de pipelines YAML
}