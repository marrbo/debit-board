// models/Issue.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIssue extends Document {
  tenantId: string;
  scanId: mongoose.Types.ObjectId;
  patternId?: mongoose.Types.ObjectId;
  query: string;
  category: string;
  fileName: string;
  filePath: string;
  project: string;
  repository: string;
  branch: string;
  hitCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  slaHours: number;
  status: 'open' | 'fixed' | 'recurring' | 'wont_fix';
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt?: Date;
  slaDueAt: Date;
  assignedTo?: string;
  snippet?: string;
  lineNumber?: number;
  hits?: { charOffset: number; length: number }[];
}

const IssueSchema = new Schema<IIssue>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  scanId: { type: Schema.Types.ObjectId, ref: 'SASTScan', required: true },
  patternId: { type: Schema.Types.ObjectId, ref: 'VulnerabilityPattern' },
  query: { type: String, required: true },
  category: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  project: { type: String, required: true },
  repository: { type: String, required: true },
  branch: { type: String, required: true },
  hitCount: { type: Number, default: 0 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  slaHours: { type: Number, required: true },
  status: { type: String, enum: ['open', 'fixed', 'recurring', 'wont_fix'], default: 'open' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  resolvedAt: Date,
  slaDueAt: { type: Date, required: true },
  assignedTo: { type: String, ref: 'User' },
  snippet: String,
  lineNumber: Number,
  hits: [{ charOffset: Number, length: Number }],
});

IssueSchema.index({ tenantId: 1, filePath: 1, patternId: 1 });
IssueSchema.index({ tenantId: 1, status: 1 });
IssueSchema.index({ tenantId: 1, assignedTo: 1 });

export const Issue = mongoose.models.Issue || mongoose.model<IIssue>('Issue', IssueSchema);