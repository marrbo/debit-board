// lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import type { IAzureSettings } from "@/types/IAzureSettings";
import type { IUser } from "@/types/IUser";

declare module "next-auth" {
  interface Session {
    user: IUser
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    tenantId?: string;
    organization?: string;        // nome da organização (ex: "MARRBO")
      organizationData?: {
        tenantId?: string[];
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
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.sub = user.id || user.email;
        token.email = user.email;
        token.name = user.name;

        // ✅ Interpretar profile.organization (objeto JSON)
        const orgClaim = (profile as any)?.organization;
        if (orgClaim) {
          let orgData: {
            tenantId?: string[];
            id?: string;
            domain?: string;
          } | null = null;
          let orgName: string | undefined;

          // Se for string JSON, fazer parse
          if (typeof orgClaim === 'string') {
            try {
              orgData = JSON.parse(orgClaim);
            } catch {
              orgData = null;
            }
          } else if (typeof orgClaim === 'object') {
            orgData = orgClaim;
          }

          if (orgData) {
            // Pega a primeira chave como nome da organização
            const keys = Object.keys(orgData);
            if (keys.length > 0) {
              orgName = keys[0];
              const innerData = orgData[orgName];
              if (innerData && typeof innerData === 'object') {
                token.organization = orgName;
                token.organizationData = innerData;
                // Se tiver tenantId, usa como tenantId principal
                if (innerData.tenantId && Array.isArray(innerData.tenantId) && innerData.tenantId.length > 0) {
                  token.tenantId = innerData.tenantId[0];
                }
              }
            }
          }
        }

        // ✅ Sempre tentar buscar dados do Tenant no banco
        await connectToDatabase();
        let tenant = null;

        if (token.tenantId) {
          // Busca pelo tenantId vindo do Keycloak
          tenant = await Tenant.findById(token.tenantId).lean();
        }

        // Se não encontrou por tenantId, busca por email
        if (!tenant) {
          tenant = await Tenant.findOne({
            $or: [{ adminEmail: user.email }, { users: user.email }],
          }).lean();
        }

        if (tenant) {
          // Preenche token.tenantId caso ainda não exista
          token.tenantId = tenant._id.toString();
          token.azureSettings = tenant.azureSettings;
          token.isActive = tenant.isActive;
          token.onboardingCompleted = tenant.onboardingCompleted;
        }

        token.isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
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