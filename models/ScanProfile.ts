// models/ScanProfile.ts
import mongoose, { Schema, type Model } from "mongoose";
import type { IScanProfile } from "@/types/IScanProfile";
import { toObjectId } from "@/lib/mongo-id";

const ScanProfileSchema = new Schema<IScanProfile>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, ref: "Tenant" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    sub: { type: String, required: true, ref: "User" },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    patternIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "VulnerabilityPattern",
        required: true,
      },
    ],
  },
  { timestamps: true, versionKey: false },
);

ScanProfileSchema.index({ tenantId: 1, sub: 1, name: 1 }, { unique: true });
ScanProfileSchema.index({ tenantId: 1, sub: 1, createdAt: -1 });

// ============================================================
// Statics
// ============================================================
export interface ScanProfileModel extends Model<IScanProfile> {
  findVisible(tenantId: string, sub: string): Promise<IScanProfile[]>;
}

ScanProfileSchema.statics.findVisible = function (
  this: ScanProfileModel,
  tenantId: string,
  sub: string,
) {
  const tenantObjectId = toObjectId(tenantId);
  if (!tenantObjectId || !sub) return Promise.resolve([]);

  return this.find({ tenantId: { $eq: tenantObjectId }, sub: { $eq: sub } })
    .sort({ name: 1 })
    .lean<IScanProfile[]>();
};

export const ScanProfile =
  (mongoose.models.ScanProfile as ScanProfileModel) ||
  mongoose.model<IScanProfile, ScanProfileModel>(
    "ScanProfile",
    ScanProfileSchema,
  );
