// models/SavedQuery.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedQuery extends Document {
  tenantId: string;
  name: string;
  queryString: string;
  context: string; // 'issues', 'projects', etc.
  createdAt: Date;
}

const SavedQuerySchema: Schema = new Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  queryString: { type: String, required: true },
  context: { type: String, default: 'issues' },
  createdAt: { type: Date, default: Date.now },
});

export const SavedQuery = mongoose.models.SavedQuery || mongoose.model<ISavedQuery>('SavedQuery', SavedQuerySchema);