import mongoose, { Schema, type Model } from "mongoose";

export type BackupFrequency = "daily" | "weekly" | "monthly";
export type BackupSource = "primary" | "atlas";

export interface IBackupSchedule {
  _id: string; // singleton: "default"
  enabled: boolean;
  frequency: BackupFrequency;
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek?: number; // 0-6 (weekly)
  dayOfMonth?: number; // 1-31 (monthly)
  source: BackupSource;
  retentionDays: number;
  lastRunAt?: Date;
  lastRunStatus?: "success" | "failed";
  lastRunError?: string;
  nextRunAt?: Date;
  updatedAt: Date;
}

const BackupScheduleSchema = new Schema<IBackupSchedule>(
  {
    _id: { type: String, default: "default" },
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "daily",
    },
    hour: { type: Number, min: 0, max: 23, default: 3 },
    minute: { type: Number, min: 0, max: 59, default: 0 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    source: {
      type: String,
      enum: ["primary", "atlas"],
      default: "primary",
    },
    retentionDays: { type: Number, min: 1, max: 365, default: 30 },
    lastRunAt: { type: Date },
    lastRunStatus: {
      type: String,
      enum: ["success", "failed"],
    },
    lastRunError: { type: String },
    nextRunAt: { type: Date },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export const BackupSchedule =
  (mongoose.models.BackupSchedule as Model<IBackupSchedule>) ||
  mongoose.model<IBackupSchedule>("BackupSchedule", BackupScheduleSchema);