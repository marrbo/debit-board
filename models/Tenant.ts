// models/Tenant.ts
import type { IAzureSettings } from '@/types/IAzureSettings';
import type { ITenant } from '@/types/ITenant';
import mongoose, { Schema, type Model } from 'mongoose';

export const azureSettings: IAzureSettings = {
    instanceUrl: 'https://example.com',
    azureCollection: 'defaultCollection',
    pat: 'pat',
    username: 'username',
    defaultProject: 'project',
    defaultRepository: 'repository',
    reportTitle: 'reportTitle',
    ignoreTlsErrors: true,
  };

const TenantSchema = new Schema<ITenant>({
  _id: { type: Schema.Types.ObjectId, auto: true },
  uuid: { type: String, required: true, unique: true }, // Garante unicidade no banco
  name: { type: String, required: true, unique: true }, // Garante unicidade do nome
  dominio: { type: String, unique: true, sparse: true },

  onboardingCompleted: { type: Boolean, default: false },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  keycloakIssuer: String,
  keycloakClientId: String,
  keycloakClientSecret: String,

  azureSettings: { type: Object, required: true, default: azureSettings },
});

export const Tenant: Model<ITenant> = 
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);