// models/SASTScan.ts
import type { ISASTScan } from "@/types/ISASTScan";
import type { Model } from "mongoose";
import mongoose, { Schema } from "mongoose";

const SASTScanSchema = new Schema<ISASTScan>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Tenant",
      index: true,
    },
    scanId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      match: /^SCAN-\d{8}-[A-Z0-9]{6}$/,
    },
    origin: {
      type: String,
      enum: [
        "azure-search-code",
        "sonarqube",
        "trivy",
        "dependency-track",
        "snyk",
      ],
      default: "azure-search-code",
      required: true,
      index: true,
    },
    scanDate: { type: Date, default: Date.now, index: true },
    completedAt: Date,
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    totalOccurrences: { type: Number, default: 0 },
    patternCount: { type: Number, default: 0 },
    failedPatterns: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskBand: {
      type: String,
      enum: ["minimal", "low", "moderate", "high", "critical"],
      default: "minimal",
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "ScanProfile",
      default: null,
    },
    profileName: { type: String, default: null },
    rerunOfScanId: {
      type: Schema.Types.ObjectId,
      ref: "SASTScan",
      default: null,
    },
    durationMs: { type: Number, default: null },
    errorMessage: String,
    summary: [
      {
        _id: false,
        azureCollection: String,
        project: String,
        repository: String,
        occurrences: Number,
      },
    ],
  },
  { timestamps: true, versionKey: false },
);

// `scanId` único por tenant — dois tenants podem ter o mesmo scanId
// se rodarem no mesmo dia (raro, mas possível)
SASTScanSchema.index({ tenantId: 1, scanId: 1 }, { unique: true });

// Listagem por tenant ordenada por data
SASTScanSchema.index({ tenantId: 1, scanDate: -1 });

// Filtro por origem + tenant
SASTScanSchema.index({ tenantId: 1, origin: 1, scanDate: -1 });

// ============================================================
// Hook — gerar scanId em `save()` se ausente
// ============================================================
/**
 * Gera `scanId` a partir de `scanDate` + últimos 6 chars do ObjectId.
 * Formato determinístico: `SCAN-{YYYYMMDD}-{XXXXXX}`.
 *
 * Idempotente — se `scanId` já estiver preenchido, não faz nada.
 */
SASTScanSchema.pre("save", async function () {
  if (this.scanId) return;

  const date = this.scanDate ?? new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");

  const oid = String(this._id ?? new mongoose.Types.ObjectId());
  const suffix = oid.slice(-6).toUpperCase();

  this.scanId = `SCAN-${yyyymmdd}-${suffix}`;
});

export const SASTScan: Model<ISASTScan> =
  mongoose.models.SASTScan ||
  mongoose.model<ISASTScan>("SASTScan", SASTScanSchema);
