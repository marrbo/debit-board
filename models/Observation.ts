import mongoose, { Schema, type Model } from "mongoose";
import type { IObservation } from "@/types/IObservation";
import { toObjectId } from "@/lib/mongo-id";

const ObservationSchema = new Schema<IObservation>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, ref: "Tenant" },
    scanId: { type: Schema.Types.ObjectId, required: true, ref: "SASTScan" },
    patternId: { type: Schema.Types.ObjectId, ref: "VulnerabilityPattern" },
    query: { type: String, required: true },
    category: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    project: { type: String, required: true },
    repository: { type: String, required: true },
    branch: { type: String, required: true },
    hitCount: { type: Number, default: 0 },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    slaHours: { type: Number, required: true },
    status: {
      type: String,
      enum: ["open", "resolved", "recurring", "wont_fix", "expired"],
      default: "open",
    },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    slaDueAt: { type: Date, required: true },
    assignedTo: { type: String, ref: "User" },
    snippet: { type: String },
    lineNumber: { type: Number },
    hits: [
      {
        _id: false,
        charOffset: { type: Number, required: true },
        length: { type: Number, required: true },
      },
    ],
  },
  { versionKey: false },
);

ObservationSchema.index({ tenantId: 1, filePath: 1, patternId: 1 });
ObservationSchema.index({ tenantId: 1, status: 1 });
ObservationSchema.index({ tenantId: 1, assignedTo: 1 });
ObservationSchema.index({ tenantId: 1, slaDueAt: 1 });

// ============================================================
// Statics
// ============================================================
export interface ObservationModel extends Model<IObservation> {
  findCriticals(tenantId: string): Promise<IObservation[]>;
  findOverdueSla(tenantId: string): Promise<IObservation[]>;
}

ObservationSchema.statics.findCriticals = function (
  this: ObservationModel,
  tenantId: string,
) {
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId) return Promise.resolve([]);

  return this.find({
    tenantId: { $eq: tenantObjectId },
    severity: { $eq: "critical" },
  })
    .sort({ firstSeen: -1 })
    .lean<IObservation[]>();
};

ObservationSchema.statics.findOverdueSla = function (
  this: ObservationModel,
  tenantId: string,
) {
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId) return Promise.resolve([]);

  return this.find({
    tenantId: { $eq: tenantObjectId },
    status: { $in: ["open", "recurring"] },
    slaDueAt: { $lt: new Date() },
  })
    .sort({ slaDueAt: 1 })
    .lean<IObservation[]>();
};

export const Observation =
  (mongoose.models.Observation as ObservationModel) ||
  mongoose.model<IObservation, ObservationModel>(
    "Observation",
    ObservationSchema,
  );