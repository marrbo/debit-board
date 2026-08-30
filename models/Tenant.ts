// models/Tenant.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';


export interface IAzureSettings {
  instanceUrl: string;
  azureCollection: string;
  pat: string;
  username?: string;
  defaultProject?: string;
  defaultRepository?: string;
  reportTitle?: string;
  ignoreTlsErrors: boolean,
};

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

  azureSettings: IAzureSettings;
}

const azureSettings: IAzureSettings = {
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
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  keycloakIssuer: String,
  keycloakClientId: String,
  keycloakClientSecret: String,

  azureSettings: { type: Object, required: true, default: azureSettings },
});

export const Tenant: Model<ITenant> = 
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);