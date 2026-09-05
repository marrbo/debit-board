import type { IObservation } from '@/types/IObservation';
import mongoose, { Schema } from 'mongoose';

const ObservationSchema = new Schema<IObservation>({
  tenantId: { type: String, required: true, ref: 'Tenant' },
  scanId: { type: Schema.Types.ObjectId, ref: 'SASTScan', required: true },
  patternId: { type: Schema.Types.ObjectId, ref: 'VulnerabilityPattern' },
  pattern: { type: Schema.Types.Mixed, ref: 'VulnerabilityPattern' },
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
  status: {
    type: String,
    enum: ['open', 'resolved', 'recurring', 'wont_fix', 'expired'],
    default: 'open',
  },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  resolvedAt: Date,
  slaDueAt: { type: Date, required: true },
  assignedTo: { type: String, ref: 'User' },
  snippet: String,
  lineNumber: Number,
  hits: [{ charOffset: Number, length: Number }],
});

// ÍNDICES OTIMIZADOS
ObservationSchema.index({ tenantId: 1, filePath: 1, patternId: 1 });
ObservationSchema.index({ tenantId: 1, status: 1 });
ObservationSchema.index({ tenantId: 1, assignedTo: 1 });
ObservationSchema.index({ slaDueAt: 1 }); 
ObservationSchema.index({ tenantId: 1, slaDueAt: 1 });

// Agora a interface tem membros, então o aviso desaparece
interface ObservationModel extends mongoose.Model<IObservation> {
  // Exemplo: se você quiser criar um método para buscar apenas as críticas
  findCriticals(): Promise<IObservation[]>;
}

export const Observation = (
  mongoose.models.Observation || 
  mongoose.model<IObservation, ObservationModel>('Observation', ObservationSchema)
) as ObservationModel; 