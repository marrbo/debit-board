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
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

SavedQuerySchema.index({ tenantId: 1, visibility: 1, context: 1 });
SavedQuerySchema.index({ tenantId: 1, userId: 1, visibility: 1 });

// ============================================================
// Statics — valores sempre pré-cast para ObjectId
// ============================================================
export interface SavedQueryModel extends Model<ISavedQuery> {
  findPublic(tenantId: string): Promise<ISavedQuery[]>;
  findTemporary(
    tenantId: string,
    userId: string,
  ): Promise<ISavedQuery | null>;
}

SavedQuerySchema.statics.findPublic = function (
  this: SavedQueryModel,
  tenantId: string,
) {
  // 🔒 Cast antes da query — bloqueia injeção de operadores Mongo
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId) return Promise.resolve([]);

  return this.find({
    tenantId: { $eq: tenantObjectId },
    visibility: { $eq: "public" },
  })
    .sort({ createdAt: -1 })
    .lean<ISavedQuery[]>();
};

SavedQuerySchema.statics.findTemporary = function (
  this: SavedQueryModel,
  tenantId: string,
  userId: string,
) {
  // 🔒 Cast antes da query — bloqueia injeção de operadores Mongo.
  // Se qualquer ID for inválido, retorna null sem tocar o banco.
  const tenantObjectId = toObjectId(tenantId);
  const userObjectId = toObjectId(userId);
  if (!tenantObjectId || !userObjectId) return Promise.resolve(null);

  return this.findOne({
    tenantId: { $eq: tenantObjectId },
    userId: { $eq: userObjectId },
    visibility: "temporary",
  });
};

export const SavedQuery =
  (mongoose.models.SavedQuery as SavedQueryModel) ||
  mongoose.model<ISavedQuery, SavedQueryModel>("SavedQuery", SavedQuerySchema);