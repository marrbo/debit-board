import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISearchRecord extends Document {
  query: string;
  vulnerabilityType?: string;
  results: any[];
  totalHits: number;
  gerencia?: string;
  nucleo?: string;
  source: 'manual' | 'sast';
  tenantId: string;
  createdAt: Date;
}

const SearchRecordSchema = new Schema<ISearchRecord>({
  query: { type: String, required: true },
  vulnerabilityType: String,
  results: { type: [Schema.Types.Mixed] as any, default: [] },
  totalHits: { type: Number, default: 0 },
  gerencia: String,
  nucleo: String,
  source: { type: String, enum: ['manual', 'sast'], required: true },
  tenantId: { type: String, ref: 'Tenant', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const SearchRecord: Model<ISearchRecord> = 
  mongoose.models.SearchRecord || mongoose.model<ISearchRecord>('SearchRecord', SearchRecordSchema);