// types/IUser.ts
import type { Document } from 'mongoose';
import type { IAzureSettings } from './IAzureSettings';

export type IUser = Document & {
  id: string;
  sub: string;
  email: string;
  name?: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  tenantId: string;
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