// models/Project.ts
import type { IProject } from "@/types/IProject";
import mongoose, { type Model, Schema } from "mongoose";
import { Team } from "./Team";

const ProjectSchema = new Schema<IProject>({
  tenantId: { type: mongoose.Types.ObjectId, required: true, ref: "Tenant" },
  teamId: { type: mongoose.Types.ObjectId, ref: "Team", default: null },
  azureProjectId: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String },
  defaultTeamImageUrl: { type: String },
  repositoryCount: { type: Number, default: 0 },
  syncDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  pipelineCount: { type: Number, default: 0 },
  pipelineFailedCount: { type: Number, default: 0 },
  pipelineClassicCount: { type: Number, default: 0 },
  pipelineYamlCount: { type: Number, default: 0 },
  pipelineSuccessCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

ProjectSchema.index({ tenantId: 1, azureProjectId: 1 }, { unique: true });
ProjectSchema.index({ teamId: 1 });
// Se `teamId` é opcional e você filtra por tenant junto:
ProjectSchema.index({ tenantId: 1, teamId: 1 });

ProjectSchema.post("save", async function (doc) {
  if (doc.teamId) {
    await Team.updateOne(
      { _id: doc.teamId },
      { $addToSet: { projectIds: doc._id } },
    );
  }
});

ProjectSchema.post("findOneAndDelete", async function (doc) {
  if (doc?.teamId) {
    await Team.updateOne(
      { _id: doc.teamId },
      { $pull: { projectIds: doc._id } },
    );
  }
});

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
