// types/ITenant.ts
import type { Document, Types } from 'mongoose';
import type { IAzureSettings } from './IAzureSettings';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  uuid: string;          // Identificador único gerado por nós (UUID)
  name: string;          // Nome da empresa, único
  createdAt: Date;
  // Campos de autenticação
  keycloakIssuer?: string;
  keycloakClientId?: string;
  keycloakClientSecret?: string;

  dominio: string;
  isActive: boolean;

  azureSettings?: IAzureSettings;
  onboardingCompleted?: boolean;
}