// types/IObservation.ts
import type { IVulnerabilityPattern } from '@/models/VulnerabilityPattern';
import type { Document } from 'mongoose';
import type mongoose from 'mongoose';

export type IObservation = Document & {
  tenantId: mongoose.Types.ObjectId;
  scanId: mongoose.Types.ObjectId;
  patternId: mongoose.Types.ObjectId;
  pattern?: Partial<IVulnerabilityPattern>;
  patternName?: string;
  query: string;
  description?: string;
  recommendation?: string;
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