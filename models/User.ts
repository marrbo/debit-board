// models/User.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  sub: string;
  email: string;
  name?: string;
  company?: string;        // Dado pessoal do usuário
  jobTitle?: string;       // Novo campo pessoal
  phone?: string;          // Novo campo pessoal
  tenantId: string;
  onboardingCompleted: boolean;
  isActive: boolean;
  roles?: string[];
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  sub: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  company: String,
  jobTitle: String,
  phone: String,
  tenantId: { type: String, ref: 'Tenant', required: true },
  onboardingCompleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  roles: [String],
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);