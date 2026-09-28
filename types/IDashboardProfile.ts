// types/IDashboardProfile.ts
import type mongoose from "mongoose";
import type { Document, Types } from "mongoose";

export type DashboardProfileKind = "dashboard" | "tv";
export type DashboardProfileVisibility = "private" | "shared" | "public";
export type WidgetSpan = 2 | 3 | 4 | 6;

export interface IDashboardWidgetRef {
  widgetId: string;
  visible: boolean;
  order: number;
  span: WidgetSpan;
}

export interface IDashboardProfileTV {
  /** Time inicial. Ignorado se `cycleTeams === true`. */
  teamId?: mongoose.Types.ObjectId | null;
  /** Segundos entre refreshes. `0` = desativado. */
  refreshSec: number;
  /** Quando `true`, o TV itera pelos times a cada ciclo. */
  cycleTeams: boolean;
}

export interface IDashboardProfile extends Document {
  name: string;
  kind: DashboardProfileKind;
  visibility: DashboardProfileVisibility;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  sub: string;
  layout: IDashboardWidgetRef[];
  tv?: IDashboardProfileTV;
  /** `sub`s dos usuários que favoritaram este perfil. */
  favorites: string[];
  createdAt: Date;
  updatedAt: Date;
}
