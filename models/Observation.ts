// models/Observation.ts
import mongoose, { Schema, Document } from 'mongoose';

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

// ============================================================
// ÍNDICES OTIMIZADOS (incluindo slaDueAt para consultas de expiração)
// ============================================================
ObservationSchema.index({ tenantId: 1, filePath: 1, patternId: 1 });
ObservationSchema.index({ tenantId: 1, status: 1 });
ObservationSchema.index({ tenantId: 1, assignedTo: 1 });
ObservationSchema.index({ slaDueAt: 1 }); // Agiliza buscas com $expr: { $lte: ["$slaDueAt", "$$NOW"] }
ObservationSchema.index({ tenantId: 1, slaDueAt: 1 }); // Consultas por tenant + expiração

// ============================================================
// MÉTODOS ESTÁTICOS - ABORDAGEM 3 (Cálculo dinâmico via aggregation)
// ============================================================

interface IObservationModel extends mongoose.Model<IObservation> {
  /**
   * Busca observações com o campo `computedStatus` calculado em tempo real.
   * - Se `slaDueAt` <= data/hora atual => `computedStatus = "expired"`
   * - Caso contrário => `computedStatus` = valor do campo `status` persistido.
   */
  findWithComputedStatus(filter?: Record<string, unknown>): Promise<IObservation[] & { computedStatus: string }[]>;

  /**
   * Busca apenas observações que já expiraram (status calculado = "expired").
   * Útil para listas de vencidos, notificações ou dashboards.
   */
  findExpiredObservations(filter?: Record<string, unknown>): Promise<IObservation[]>;

  /**
   * Busca uma observação por ID e retorna com o status calculado.
   */
  findByIdWithComputedStatus(id: string | mongoose.Types.ObjectId): Promise<(IObservation & { computedStatus: string }) | null>;

  /**
   * Busca observações com status calculado, com suporte a paginação.
   * @param filter - Filtro MongoDB (ex: { tenantId, severity })
   * @param page - Número da página (começa em 1)
   * @param limit - Itens por página
   * @param sort - Ordenação (ex: { slaDueAt: 1 })
   */
  findPaginatedWithComputedStatus(
    filter?: Record<string, unknown>,
    page?: number,
    limit?: number,
    sort?: Record<string, 1 | -1>
  ): Promise<{
    data: (IObservation & { computedStatus: string })[];
    total: number;
    page: number;
    totalPages: number;
  }>;
}

// Implementação dos métodos estáticos
ObservationSchema.statics.findWithComputedStatus = async function (
  filter: Record<string, unknown> = {}
): Promise<any[]> {
  return await this.aggregate([
    { $match: filter },
    {
      $addFields: {
        computedStatus: {
          $cond: {
            if: { $lte: ['$slaDueAt', '$$NOW'] },
            then: 'expired',
            else: '$status',
          },
        },
      },
    },
  ]);
};

ObservationSchema.statics.findExpiredObservations = async function (
  filter: Record<string, any> = {}
): Promise<any[]> {
  return await this.aggregate([
    { $match: { ...filter } },
    {
      $match: {
        $expr: { $lte: ['$slaDueAt', '$$NOW'] },
      },
    },
  ]);
};

ObservationSchema.statics.findByIdWithComputedStatus = async function (
  id: string | mongoose.Types.ObjectId
): Promise<any | null> {
  const result = await this.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $addFields: {
        computedStatus: {
          $cond: {
            if: { $lte: ['$slaDueAt', '$$NOW'] },
            then: 'expired',
            else: '$status',
          },
        },
      },
    },
  ]);
  return result[0] || null;
};

ObservationSchema.statics.findPaginatedWithComputedStatus = async function (
  filter: Record<string, any> = {},
  page: number = 1,
  limit: number = 20,
  sort: Record<string, 1 | -1> = { slaDueAt: 1 }
): Promise<{
  data: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.aggregate([
      { $match: filter },
      {
        $addFields: {
          computedStatus: {
            $cond: {
              if: { $lte: ['$slaDueAt', '$$NOW'] },
              then: 'expired',
              else: '$status',
            },
          },
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ]),
    this.countDocuments(filter),
  ]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

// Exportação do modelo tipado
export const Observation = (mongoose.models.Observation ||
  mongoose.model<IObservation, IObservationModel>('Observation', ObservationSchema)) as IObservationModel;