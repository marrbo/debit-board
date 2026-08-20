// models/SASTScan.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISASTScan extends Document {
  tenantId: string;
  scanDate: Date;
  patterns: {
    patternId: string;
    query: string;
    category: string;
    hits: any[];
    results: any[];
    hitCount: number;
  }[];
  totalOccurrences: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  summary: {
    azureCollection: string;
    project: string;
    repository: string;
    occurrences: number;
  }[];
}

const SASTScanSchema = new Schema<ISASTScan>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  scanDate: { type: Date, default: Date.now },
  patterns: [{
    patternId: { type: String, required: true },
    query: { type: String, required: true },
    category: { type: String },
    results: { type: [Schema.Types.Mixed], default: [] },
    hitCount: { type: Number, default: 0 },
  }],
  totalOccurrences: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' },
  summary: [{
    azureCollection: String,
    project: String,
    repository: String,
    occurrences: Number,
  }],
});

export const SASTScan: Model<ISASTScan> = 
  mongoose.models.SASTScan || mongoose.model<ISASTScan>('SASTScan', SASTScanSchema);