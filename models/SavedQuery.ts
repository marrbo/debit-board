// models/SavedQuery.ts
import type { ISavedQuery } from '@/types/ISavedQuery';
import { model, models, Schema, type Model } from 'mongoose';

export interface SavedQueryModel extends Model<ISavedQuery> {
  findCriticals(): Promise<ISavedQuery[]>;
}

const SavedQuerySchema = new Schema<ISavedQuery>({
  name: { type: String, required: true },
  queryString: { type: String, required: true },
  context: {
    type: String,
    enum: ['observations', 'projects', 'repositories', 'stats'],
    required: true
  },
  visibility: {
    type: String,
    enum: ['private', 'shared', 'public', 'temporary'],
    default: 'private'
  },
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export const SavedQuery = (models.SavedQuery || model<ISavedQuery, SavedQueryModel>('SavedQuery', SavedQuerySchema)) as SavedQueryModel;