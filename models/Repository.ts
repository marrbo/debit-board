// models/Repository.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRepository extends Document {
  tenantId: string;
  projectId: String;
  name: string; // Nome do repositório do Azure
  createdAt: Date;
}

const RepositorySchema = new Schema<IRepository>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  name: { type: String, required: true },
  projectId: [{ type: String, required: true, ref: 'Project' }],
  createdAt: { type: Date, default: Date.now },
});

export const Repository: Model<IRepository> = mongoose.models.Repository || mongoose.model<IRepository>('Repository', RepositorySchema);