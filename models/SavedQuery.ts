import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ISavedQuery extends Document {
  tenantId: string;
  name: string;
  queryString: string;
  context: string;
  visibility: 'private' | 'shared' | 'public' | 'temporary';
  createdAt: Date;
}

const SavedQuerySchema: Schema = new Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  queryString: { type: String, required: true },
  context: { type: String, default: 'issues' },
  visibility: { 
    type: String, 
    enum: ['private', 'shared', 'public', 'temporary'], 
    default: 'private' 
  },
  createdAt: { type: Date, default: Date.now },
});

export const SavedQuery = mongoose.models.SavedQuery || mongoose.model<ISavedQuery>('SavedQuery', SavedQuerySchema);