import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedQuery extends Document {
  tenantId: string;
  sub: string;
  name: string;
  queryString: string;
  context: string;
  visibility: 'private' | 'shared' | 'public' | 'temporary';
  createdAt: Date;
}

const SavedQuerySchema: Schema = new Schema({
  tenantId: { type: String, required: true, index: true, ref: 'Tenant' },
  sub: { type: String, required: true, index: true, ref: 'User' },
  name: { type: String, required: true },
  queryString: { type: String, required: true },
  context: { type: String, default: 'observations' },
  visibility: { 
    type: String, 
    enum: ['private', 'shared', 'public', 'temporary'], 
    default: 'private' 
  },
  createdAt: { type: Date, default: Date.now },
});

export const SavedQuery = mongoose.models.SavedQuery || mongoose.model<ISavedQuery>('SavedQuery', SavedQuerySchema);