// types/next-auth.d.ts
import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type { IAzureSettings } from "@/types/IAzureSettings";

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * ID do usuário no banco, como **string**.
       * O Next.js 16 (Turbopack) recusa `ObjectId` do Mongoose ao
       * passar de Server Component para Client Component ("Objects
       * with toJSON methods are not supported"), então a fronteira
       * `session()` em `lib/auth-options.ts` faz `String()`.
       */
      _id: string;
      sub: string;
      /**
       * Tenant do usuário, como **string** — mesma razão de `_id`.
       */
      tenantId?: string;
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
      // 🔥 RBAC — expostos em `auth-options.session()`
      groups?: string[];
      realmRoles?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    sub?: string;
    /**
     * Tenant do usuário, como **string**. O cookie JWT serializa
     * ObjectId como string de qualquer forma; manter o tipo como
     * string elimina a ambiguidade "às vezes ObjectId, às vezes
     * string" que existia entre o primeiro request pós-login e os
     * subsequentes.
     */
    tenantId?: string;
    organization?: string;
    organizationData?: {
      tenantId?: string;
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
