// models/Project.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
  tenantId: string;
  name: string; // Nome do repositório do Azure
  teamIds: string[]; // Times associados a este projeto
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  name: { type: String, required: true },
  teamIds: [{ type: String, ref: 'Team' }],
  createdAt: { type: Date, default: Date.now },
});

export const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);