// models/Team.ts

import type { ITeam } from "@/types/ITeam";
import mongoose, { Schema } from "mongoose";

const TeamSchema = new Schema<ITeam>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  name: { type: String, required: true },
  description: { type: String },
  members: [{ type: String, ref: 'User' }],
  projectIds: [{ type: String, ref: 'Project' }],
  projectCount: [{ type: Number, default: 0 }],
  isGlobal: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Agora a interface tem membros, então o aviso desaparece
interface TeamModel extends mongoose.Model<ITeam> {
  // Exemplo: se você quiser criar um método para buscar apenas as críticas
  findGlobal(): Promise<ITeam[]>;
}

export const Team = (
  mongoose.models.Team || 
  mongoose.model<ITeam, TeamModel>('Team', TeamSchema)
) as TeamModel;