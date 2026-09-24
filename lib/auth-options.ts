// lib/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { User } from "@/models/User";

const KEYCLOAK_LOCAL_URL = "http://localhost:8080";
const REALM = "debit-board";
const ADMIN_GROUP = "Administrators";

/**
 * Detecta se os cookies de sessão devem ser marcados com `Secure`.
 *
 * Ordem de precedência:
 *  1. `NEXTAUTH_USE_SECURE_COOKIES` — override explícito ("true" | "false")
 *  2. `NEXTAUTH_URL` — se começar com "https://", usa secure
 *  3. Fallback: `NODE_ENV === "production"`
 *
 * O ponto (1) existe porque em ambientes atrás de proxy reverso
 * (Cloudflare, ALB, Nginx) a URL pública pode não refletir o esquema
 * real, e você pode querer forçar o comportamento sem mexer no resto.
 */
function detectSecureCookies(): boolean {
  const explicit = process.env.NEXTAUTH_USE_SECURE_COOKIES;
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  const url = process.env.NEXTAUTH_URL;
  if (url) return url.startsWith("https://");

  return process.env.NODE_ENV === "production";
}

const useSecureCookies = detectSecureCookies();

export const authOptions: NextAuthOptions = {
  debug: false,
  useSecureCookies: useSecureCookies,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      authorization: {
        url: `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/auth`,
        params: {
          scope: "openid profile email groups organization",
        },
      },
      token: `${KEYCLOAK_LOCAL_URL}/realms/${REALM}/protocol/openid-connect/token`,
      userinfo: `${KEYCLOAK_LOCAL_URL}/realms/${REALM}/protocol/openid-connect/userinfo`,
      jwks_endpoint: `${KEYCLOAK_LOCAL_URL}/realms/${REALM}/protocol/openid-connect/certs`,
      client: {
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
        token.name =
          kcProfile.name ?? kcProfile.preferred_username ?? token.name;

        const groups = Array.isArray(kcProfile.groups) ? kcProfile.groups : [];
        token.groups = groups;

        const orgClaim = kcProfile.organization;
        if (orgClaim && typeof orgClaim === "object") {
          const orgName = orgClaim[0];
          if (orgName) {
            token.organization = orgName;

            if (mongoose.Types.ObjectId.isValid(orgName)) {
              token.organizationData = {
                tenantId: new mongoose.Types.ObjectId(orgName),
              };
              token.tenantId = token.organizationData.tenantId;
            }
          }
        }

        const roles = (kcProfile.realm_access?.roles ?? []) as string[];
        token.realmRoles = roles;

        const isInAdminGroup = groups.some(
          (g: string) => g === ADMIN_GROUP || g === `/${ADMIN_GROUP}`,
        );
        token.isAdmin =
          isInAdminGroup ||
          roles.includes("admin") ||
          token.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

        // Propaga o JWT ID (jti) do Keycloak — disponível no profile
        token.jti = kcProfile.jti ?? token.jti;
      }

      if (user && token.tenantId && !token.azureSettings) {
        await connectToDatabase();
        const tenant = await Tenant.findById(token.tenantId).lean();
        if (tenant) {
          token.azureSettings = tenant.azureSettings;
          token.organizationData = {
            tenantId: tenant._id,
            domain: tenant.dominio,
            id: tenant.uuid,
            isActive: tenant.isActive,
          };
          token.isActive = tenant.isActive;
          token.onboardingCompleted = tenant.onboardingCompleted;
        }
      }

      return token;
    },

    async session({ session, token }) {
      const cookieStore = await cookies();
      const impersonatingUser = cookieStore.get("impersonating_user")?.value;
      const impersonatingAdmin = cookieStore.get(
        "impersonating_admin_id",
      )?.value;

      if (impersonatingUser && impersonatingAdmin) {
        await connectToDatabase();
        const target = await User.findOne({ sub: impersonatingUser }).lean();

        if (target) {
          const tenant = target.tenantId
            ? await Tenant.findById(target.tenantId).lean()
            : null;

          session.user = {
            ...session.user,
            _id: target._id,
            sub: target.sub,
            name: target.name,
            email: target.email,
            avatar: target.avatar,
            role: (target as any).role ?? "user",
            tenantId: tenant?._id,
            onboardingCompleted: target.onboardingCompleted,
            isActive: target.isActive ?? true,
            impersonating: true,
            originalAdminSub: impersonatingAdmin,
            // Nunca dá privilégio de admin em impersonação
            isAdmin: false,
          };

          return session;
        }
      }

      // ---- Caminho normal (sem impersonação) ----
      // Antes o código só setava `sub`, o que fazia requireAdmin/requireSession falharem.
      if (session.user) {
        session.user.sub = (token.sub as string) ?? "";
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;

        session.user.isAdmin = token.isAdmin ?? false;
        session.user.isActive = token.isActive ?? true;
        session.user.tenantId = token.tenantId;
        session.user.organization = token.organization;
        session.user.onboardingCompleted = token.onboardingCompleted;
        session.user.azureSettings = token.azureSettings;

        session.user.impersonating = false;
      }

      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
};
