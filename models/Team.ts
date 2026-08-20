// models/Team.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeam extends Document {
  tenantId: string;
  name: string;
  members: string[]; // Array de 'sub' dos usuários
  projects: string[]; // Array de IDs dos Projetos
  isGlobal: boolean;  // Se é o time global do tenant (não aparece nas listagens)
  createdAt: Date;
}

const TeamSchema = new Schema<ITeam>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  name: { type: String, required: true },
  members: [{ type: String, ref: 'User' }],
  projects: [{ type: String, ref: 'Project' }],
  isGlobal: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);