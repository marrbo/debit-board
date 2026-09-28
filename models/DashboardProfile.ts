// models/DashboardProfile.ts
import mongoose, { Schema, type Model } from "mongoose";
import type { IDashboardProfile } from "@/types/IDashboardProfile";
import { toObjectId } from "@/lib/mongo-id";

const WidgetRefSchema = new Schema(
  {
    widgetId: { type: String, required: true },
    visible: { type: Boolean, required: true },
    order: { type: Number, required: true },
    span: { type: Number, enum: [2, 3, 4, 6], required: true },
  },
  { _id: false },
);

const TVSchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, default: null, ref: "Team" },
    refreshSec: { type: Number, default: 60, min: 0 },
    cycleTeams: { type: Boolean, default: false },
  },
  { _id: false },
);

const DashboardProfileSchema = new Schema<IDashboardProfile>(
  {
    name: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["dashboard", "tv"],
      default: "dashboard",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["private", "shared", "public"],
      default: "private",
      required: true,
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
    sub: { type: String, required: true, ref: "User" },
    layout: { type: [WidgetRefSchema], default: [] },
    tv: { type: TVSchema, default: undefined },
    favorites: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false },
);

// Unicidade por nome dentro do escopo do usuário
DashboardProfileSchema.index(
  { tenantId: 1, sub: 1, name: 1 },
  { unique: true },
);
DashboardProfileSchema.index({ tenantId: 1, sub: 1, createdAt: -1 });
DashboardProfileSchema.index({ tenantId: 1, visibility: 1, kind: 1 });
DashboardProfileSchema.index({ visibility: 1, createdAt: -1 });
DashboardProfileSchema.index({ favorites: 1 });

export interface DashboardProfileModel extends Model<IDashboardProfile> {
  findVisible(
    tenantId: mongoose.Types.ObjectId,
    sub: string,
  ): Promise<IDashboardProfile[]>;
}

/**
 * Lista perfis visíveis: public (cross-tenant), shared do tenant, e
 * private do próprio usuário. Ordena favoritos primeiro, depois por
 * data de criação decrescente.
 *
 * A ordenação final por "favoritos primeiro" é feita em memória no
 * endpoint — o Mongo não suporta ordenar por "está na lista" sem
 * pipeline. Aqui só filtramos.
 */
DashboardProfileSchema.statics.findVisible = function (
  this: DashboardProfileModel,
  tenantId: mongoose.Types.ObjectId,
  sub: string,
) {
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId || !sub) {
    return this.find({ visibility: { $eq: "public" } }).lean<
      IDashboardProfile[]
    >();
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
    ],
  }).lean<IDashboardProfile[]>();
};

export const DashboardProfile =
  (mongoose.models.DashboardProfile as DashboardProfileModel) ||
  mongoose.model<IDashboardProfile, DashboardProfileModel>(
    "DashboardProfile",
    DashboardProfileSchema,
  );
