// types/next-auth.d.ts
import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type mongoose from "mongoose";
import type { IAzureSettings } from "@/types/IAzureSettings";

declare module "next-auth" {
  interface Session {
    user: {
      _id: mongoose.Types.ObjectId;
      sub: string;
      tenantId?: mongoose.Types.ObjectId;
      organization?: string;
      onboardingCompleted?: boolean;
      isActive?: boolean;
      azureSettings?: IAzureSettings;
      impersonating?: boolean;
      role?: string;
      isAdmin?: boolean;
      firstName?: string;
      avatar?: string;
      originalAdminSub?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    sub?: string;
    tenantId?: mongoose.Types.ObjectId;
    organization?: string;
    organizationData?: {
      tenantId?: mongoose.Types.ObjectId;
      id?: string;
      domain?: string;
      isActive?: boolean;
    } | null;
    onboardingCompleted?: boolean;
    isActive?: boolean;
    azureSettings?: IAzureSettings;
    impersonating?: boolean;
    isAdmin?: boolean;
    groups?: string[];
    realmRoles?: string[];
  }
}
