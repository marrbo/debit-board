// types/IScanProfile.ts
import type { Document, Types } from "mongoose";

export interface IScanProfile extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  sub: string;
  name: string;
  description?: string;
  patternIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
