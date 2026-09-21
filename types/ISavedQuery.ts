//types/ISavedQuery.ts
import type { Document, Types } from "mongoose";

export type SavedQueryContext =
  | "observations"
  | "projects"
  | "repositories"
  | "none"
  | "stats";

export type SavedQueryVisibility =
  | "private"
  | "shared"
  | "public"
  | "temporary";

export interface ISavedQuery extends Document {
  name: string;
  queryString: string;
  context: SavedQueryContext;
  visibility: SavedQueryVisibility;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  sub: string;
  createdAt: Date;
}
