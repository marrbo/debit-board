import type mongoose from "mongoose";
import { Team } from "@/models/Team";
import { Project } from "@/models/Project";
import { toObjectId } from "@/lib/mongo-id";

export interface TeamFilter {
  allowedProjectIds: mongoose.Types.ObjectId[] | null;
  allowedProjectNames: string[] | null;
}

const EMPTY_FILTER: TeamFilter = { allowedProjectIds: null, allowedProjectNames: null };

export async function resolveTeamFilter(
  teamId: string | null | undefined,
): Promise<TeamFilter> {
  if (!teamId || teamId === "all") return EMPTY_FILTER;

  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return EMPTY_FILTER;

  const team = await Team.findById(teamObjectId).lean();
  if (!team) return { allowedProjectIds: [], allowedProjectNames: [] };

  const allowedProjectIds = (team.projectIds || [])
    .map(toObjectId)
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  const teamProjects = await Project.find({ _id: { $in: allowedProjectIds } })
    .select("name")
    .lean();

  return {
    allowedProjectIds,
    allowedProjectNames: teamProjects.map((p) => p.name),
  };
}