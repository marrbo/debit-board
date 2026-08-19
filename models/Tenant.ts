// models/Tenant.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

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

  azureSettings: {
    instanceUrl: string;
    azureCollection: string;
    pat: string;
    username?: string;
    defaultProject?: string;
    defaultRepository?: string;
    reportTitle?: string;
    ignoreTlsErrors?: boolean;
  };
}

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

  azureSettings: {
    instanceUrl: String,
    azureCollection: String,
    pat: String,
    username: String,
    defaultProject: String,
    defaultRepository: String,
    reportTitle: String,
    ignoreTlsErrors: Boolean,
  },
});

export const Tenant: Model<ITenant> = 
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);