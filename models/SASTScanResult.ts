// models/SASTScanResult.ts
import type { Document, Model, Types } from 'mongoose';
import mongoose, { Schema } from 'mongoose';

export interface ISASTPatternResult {
  patternId: mongoose.Types.ObjectId;
  query: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  slaHours: number;
  results: any[];
  hitCount: number;
  error?: string;
}

export interface ISASTScanResult extends Document {
  scanId: Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  patterns: ISASTPatternResult[];
  totalOccurrences: number;
  failedPatterns: number;
  createdAt: Date;
}

const SASTScanResultSchema = new Schema<ISASTScanResult>({
  scanId: { type: Schema.Types.ObjectId, ref: 'SASTScan', required: true, index: true },
  tenantId: { type: mongoose.Types.ObjectId, required: true, index: true },
  patterns: [{
    patternId: { type: mongoose.Types.ObjectId, required: true },
    query: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    slaHours: { type: Number, default: 72 },
    results: { type: [Schema.Types.Mixed], default: [] },
    hitCount: { type: Number, default: 0 },
    error: { type: String },
  }],
  totalOccurrences: { type: Number, default: 0 },
  failedPatterns: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const SASTScanResult: Model<ISASTScanResult> =
  mongoose.models.SASTScanResult ||
  mongoose.model<ISASTScanResult>('SASTScanResult', SASTScanResultSchema);