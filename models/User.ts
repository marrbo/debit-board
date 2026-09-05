// models/User.ts
import type { IUser } from '@/types/IUser';
import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema<IUser>({
  sub: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  avatar: String,
  company: String,
  jobTitle: String,
  phone: String,
  tenantId: { type: String, ref: 'Tenant', required: true },
  onboardingCompleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  roles: [String],
  createdAt: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: false },
});

interface UserModel extends mongoose.Model<IUser> {
  findBySub(sub: string): Promise<IUser>;
}

export const User = (
  mongoose.models.User || 
  mongoose.model<IUser, UserModel>('User', UserSchema)
) as UserModel; 