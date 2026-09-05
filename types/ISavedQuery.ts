// types/ISavedQuery.ts
import type mongoose from "mongoose";
import type { Document } from 'mongoose';

export interface ISavedQuery extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  queryString: string;
  context: string;
  visibility: 'private' | 'shared' | 'public' | 'temporary';
  tenantId: string;
  createdAt?: Date;
  userId: string;
}