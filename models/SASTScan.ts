// models/SASTScan.ts
import type { Document, Model } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

export interface ISASTScan extends Document {
  tenantId: mongoose.Types.ObjectId;
  scanDate: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalOccurrences: number;
  patternCount: number;
  failedPatterns: number;
  summary: {
    azureCollection: string;
    project: string;
    repository: string;
    occurrences: number;
  }[];
}

const SASTScanSchema = new Schema<ISASTScan>({
  tenantId: { type: mongoose.Types.ObjectId, required: true, ref: 'Tenant' },
  scanDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' },
  totalOccurrences: { type: Number, default: 0 },
  patternCount: { type: Number, default: 0 },
  failedPatterns: { type: Number, default: 0 },
  summary: [{
    azureCollection: String,
    project: String,
    repository: String,
    occurrences: Number,
  }],
});

export const SASTScan: Model<ISASTScan> =
  mongoose.models.SASTScan || mongoose.model<ISASTScan>('SASTScan', SASTScanSchema);