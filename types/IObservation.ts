// types/IObservation.ts
import type { Document } from 'mongoose';
import type mongoose from 'mongoose';

export type IObservation = Document & {
  tenantId: string;
  scanId: mongoose.Types.ObjectId;
  patternId: mongoose.Types.ObjectId;
  pattern?: string;
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
  status: 'new' | 'open' | 'resolved' | 'recurring' | 'wont_fix' | 'expired';
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt?: Date;
  slaDueAt: Date;
  assignedTo?: string;
  snippet?: string;
  lineNumber?: number;
  hits?: { charOffset: number; length: number }[];
}