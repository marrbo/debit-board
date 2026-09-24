import mongoose, { Schema, type Model } from "mongoose";
import type { ISavedQuery } from "@/types/ISavedQuery";
import { toObjectId } from "@/lib/mongo-id";

const SavedQuerySchema = new Schema<ISavedQuery>(
  {
    name: { type: String, required: true, trim: true },
    queryString: { type: String, required: true, trim: true },
    context: {
      type: String,
      enum: ["observations", "projects", "repositories", "stats"],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["private", "shared", "public", "temporary"],
      default: "private",
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tenant",
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    sub: {
      type: String,
      required: false,
      ref: "User",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

SavedQuerySchema.index({ tenantId: 1, visibility: 1, context: 1 });
SavedQuerySchema.index({ tenantId: 1, userId: 1, visibility: 1 });
SavedQuerySchema.index({ tenantId: 1, sub: 1, visibility: 1 });
SavedQuerySchema.index({ visibility: 1, createdAt: -1 });

// ============================================================
// Statics — valores sempre pré-cast para ObjectId
// ============================================================
export interface SavedQueryModel extends Model<ISavedQuery> {
  findPublic(tenantId: string): Promise<ISavedQuery[]>;
  findVisible(tenantId: string): Promise<ISavedQuery[]>;
  findTemporary(tenantId: string, userId: string): Promise<ISavedQuery | null>;
}

// models/SavedQuery.ts (statics)

/**
 * Lista queries `public` (cross-tenant).
 * O parâmetro tenantId é mantido por compatibilidade de assinatura,
 * mas NÃO é usado para filtrar.
 */
SavedQuerySchema.statics.findPublic = function (
  this: SavedQueryModel,
  _tenantId: string,
) {
  return this.find({ visibility: { $eq: "public" } })
    .sort({ createdAt: -1 })
    .lean<ISavedQuery[]>();
};

/**
 * Lista queries visíveis a um usuário: public (cross-tenant),
 * shared do mesmo tenant, e private/temporary do próprio usuário.
 */
SavedQuerySchema.statics.findVisible = function (
  this: SavedQueryModel,
  tenantId: string,
  sub: string,
) {
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId || !sub) {
    // Sem tenant/user → só public
    return this.find({ visibility: { $eq: "public" } })
      .sort({ createdAt: -1 })
      .lean<ISavedQuery[]>();
  }

  return this.find({
    $or: [
      { visibility: { $eq: "public" } },
      { visibility: { $eq: "shared" }, tenantId: { $eq: tenantObjectId } },
      {
        visibility: { $eq: "private" },
        tenantId: { $eq: tenantObjectId },
        sub: { $eq: sub },
      },
      {
        visibility: { $eq: "temporary" },
        tenantId: { $eq: tenantObjectId },
        sub: { $eq: sub },
      },
    ],
  })
    .sort({ createdAt: -1 })
    .lean<ISavedQuery[]>();
};

SavedQuerySchema.statics.findTemporary = function (
  this: SavedQueryModel,
  tenantId: string,
  sub: string,
) {
  // 🔒 Cast antes da query — bloqueia injeção de operadores Mongo.
  // Se qualquer ID for inválido, retorna null sem tocar o banco.
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId || !sub) return Promise.resolve(null);

  return this.findOne({
    tenantId: { $eq: tenantObjectId },
    sub: { $eq: sub },
    visibility: "temporary",
  });
};

export const SavedQuery =
  (mongoose.models.SavedQuery as SavedQueryModel) ||
  mongoose.model<ISavedQuery, SavedQueryModel>("SavedQuery", SavedQuerySchema);
