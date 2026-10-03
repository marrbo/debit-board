// models/ObservationEvent.ts
import mongoose, { Schema, type Model } from "mongoose";
import type { IObservationEvent } from "@/types/IObservationEvent";

const ObservationEventSchema = new Schema<IObservationEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, ref: "Tenant" },
    type: {
      type: String,
      enum: [
        "detected",
        "reopened",
        "resolved",
        "wont_fix",
        "expired",
        "assigned",
        "note",
      ],
      required: true,
    },
    at: { type: Date, required: true, default: Date.now },
    actor: {
      type: {
        type: String,
        enum: ["scan", "user", "system"],
        required: true,
      },
      scanId: { type: Schema.Types.ObjectId, ref: "SASTScan" },
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      displayName: String,
    },
    observationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Observation" }],
      required: true,
    },
    patternId: { type: Schema.Types.ObjectId, ref: "VulnerabilityPattern" },
    patternName: String,
    reason: {
      type: String,
      enum: [
        "scan-not-found",
        "auto-resolved",
        "duplicate-merged",
        "manual",
        "user-action",
        "regression",
      ],
    },
    note: String,
    metadata: {
      observationCount: Number,
      files: [String],
      previousStatus: String,
      newStatus: String,
      previousAssignee: String,
      newAssignee: String,
    },
  },
  { versionKey: false },
);

// Feed por observation (query principal do drawer).
ObservationEventSchema.index({ tenantId: 1, observationIds: 1, at: -1 });

// Feed por pattern (dashboard de padrões).
ObservationEventSchema.index({ tenantId: 1, patternId: 1, at: -1 });

// Feed global do tenant.
ObservationEventSchema.index({ tenantId: 1, at: -1 });

// Auditoria por scan.
ObservationEventSchema.index({ tenantId: 1, "actor.scanId": 1 });

export const ObservationEvent =
  (mongoose.models.ObservationEvent as Model<IObservationEvent>) ||
  mongoose.model<IObservationEvent>("ObservationEvent", ObservationEventSchema);
