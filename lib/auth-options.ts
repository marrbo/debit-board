// lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import type { IAzureSettings } from "@/types/IAzureSettings";
import type { IUser } from "@/types/IUser";
import mongoose from "mongoose";

declare module "next-auth" {
  interface Session {
    user: IUser
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    tenantId?: mongoose.Types.ObjectId;
    organization?: string;        // nome da organização (ex: "MARRBO")
      organizationData?: {
        tenantId?: mongoose.Types.ObjectId;
        id?: string;
        domain?: string;
      } | null;
    onboardingCompleted?: boolean;
    isActive?: boolean;
    azureSettings?: IAzureSettings;
    impersonating?: boolean;
    isAdmin?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  debug: true,
  useSecureCookies: false,
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      authorization: {
        params: {
          // 🔥 Sem estes scopes o Keycloak não coloca groups/organization no id_token
          scope: "openid profile email groups organization",
        },
      },
      client: {
        // 🔥 Keycloak espera client_secret no body (post), não no header (basic)
        token_endpoint_auth_method: "client_secret_post",
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, profile, account }) {
      if (account?.provider === "keycloak" && profile) {
        const kcProfile = profile as Record<string, any>;

        token.sub = kcProfile.sub ?? token.sub;
        token.email = kcProfile.email ?? token.email;
        token.name = kcProfile.name ?? kcProfile.preferred_username ?? token.name;

        // Groups (array de nomes completos, ex: ["/Administrators"])
        token.groups = Array.isArray(kcProfile.groups) ? kcProfile.groups : [];

        // Organization (Keycloak 26: objeto { nomeDaOrg: { id, tenantId? } })
        const orgClaim = kcProfile.organization;
        if (orgClaim && typeof orgClaim === "object") {
          const orgName = orgClaim[0];
          if (orgName) {
            token.organization = orgName;
            //token.organizationData = orgClaim[orgName] ?? null;
            if (mongoose.Types.ObjectId.isValid(orgName)){
              token.organizationData.tenantId = new mongoose.Types.ObjectId(orgName)
              token.tenantId = token.organizationData.tenantId;
            }
          }
        }

        // Roles
        const roles = (kcProfile.realm_access?.roles ?? []) as string[];
        token.realmRoles = roles;
        token.isAdmin = roles.includes("admin") || token.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      }

      // Só na primeira execução populamos o resto do tenant
      if (user && token.tenantId && !token.azureSettings) {
        await connectToDatabase();
        const tenant = await Tenant.findById(token.tenantId).lean();
        if (tenant) {
          token.azureSettings = tenant.azureSettings;
          token.isActive = tenant.isActive;
          token.onboardingCompleted = tenant.onboardingCompleted;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.tenantId = token.tenantId;
        session.user.organization = token.organization;
        session.user.onboardingCompleted = token.onboardingCompleted;
        session.user.isActive = token.isActive;
        session.user.azureSettings = token.azureSettings;
        session.user.impersonating = token.impersonating;
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
};