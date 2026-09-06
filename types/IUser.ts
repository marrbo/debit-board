// types/IUser.ts
import type { Document } from 'mongoose';
import type { IAzureSettings } from './IAzureSettings';
import type mongoose from 'mongoose';

export type IUser = Document & {
  id: string;
  sub: string;
  email: string;
  name?: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  tenantId: mongoose.Types.ObjectId;
  onboardingCompleted: boolean;
  isActive: boolean;
  roles?: string[];
  createdAt: Date;
  isAdmin: boolean;
  azureSettings: IAzureSettings;
  organization?: string;
  organizationData?: {
    tenantId?: string[];
    id?: string;
    domain?: string;
  } | null;
  impersonating?: boolean;
}