// models/Team.ts

import type mongoose from "mongoose";

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId,
  tenantId: string;
  name: string;
  description: string;
  members: string[]; // Array de 'sub' dos usuários
  projectIds: string[]; // Array de IDs dos Projetos
  projectCount: number;
  isGlobal: boolean;  // Se é o time global do tenant (não aparece nas listagens)
  createdAt: Date;
}
