// lib/auth.ts
import { type NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import crypto from 'crypto';

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      tenantId?: string;
      onboardingCompleted?: boolean;
      name?: string | null;
      email?: string | null;
      isActive?: boolean;
      azureSettings?: any;
      impersonating?: boolean;
      isAdmin?: boolean;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    originalSub?: string;
    tenantId?: string;
    onboardingCompleted?: boolean;
    isActive?: boolean;
    azureSettings?: any;
    impersonating?: boolean;
    isAdmin?: boolean;
  }
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const providers: NextAuthOptions["providers"] = [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ];

  return {
    providers,
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = (user.id || user.email) as string;
          token.email = user.email;
          token.name = user.name;

          await connectToDatabase();

          const isAdmin = token.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          token.isAdmin = isAdmin;

          const cookieStore = await cookies();
          const impersonatingCookie = cookieStore.get('impersonating_user')?.value;

          // ========================================================
          // 1. Lógica de IMPERSONAÇÃO (Admin impersonando outro usuário)
          // ========================================================
          if (isAdmin && impersonatingCookie) {
            const targetUser = await (User as any).findOne({ sub: impersonatingCookie });
            if (targetUser && targetUser.tenantId !== 'pending') {
              token.originalSub = token.sub;
              token.sub = targetUser.sub;
              token.email = targetUser.email;
              token.name = targetUser.name;
              token.tenantId = targetUser.tenantId;
              token.onboardingCompleted = targetUser.onboardingCompleted;
              token.isActive = targetUser.isActive;
              token.impersonating = true;
              
              const targetTenant = await Tenant.findById(targetUser.tenantId);
              token.azureSettings = targetTenant?.azureSettings || {};
              return token;
            } else {
              cookieStore.delete('impersonating_user');
            }
          }

          // ========================================================
          // 2. Lógica de AUTO-RESET (Admin saindo da impersonação)
          // ========================================================
          if (isAdmin && token.impersonating && !impersonatingCookie) {
            const realAdmin = await (User as any).findOne({ email: process.env.NEXT_PUBLIC_ADMIN_EMAIL });
            if (realAdmin) {
              token.sub = realAdmin.sub;
              token.email = realAdmin.email;
              token.name = realAdmin.name;
              token.tenantId = realAdmin.tenantId;
              token.onboardingCompleted = realAdmin.onboardingCompleted;
              token.isActive = realAdmin.isActive;
              token.impersonating = false;
              delete token.originalSub;
              
              const adminTenant = await Tenant.findById(realAdmin.tenantId);
              token.azureSettings = adminTenant?.azureSettings || {};
            }
            return token;
          }

          // ========================================================
          // 3. Login padrão do ADMIN (Força o tenant correto)
          // ========================================================
          if (isAdmin) {
            let adminTenant = await Tenant.findOne({ uuid: 'tenant_admin' });
            if (!adminTenant) {
              adminTenant = new Tenant({
                uuid: 'tenant_admin',
                name: 'Administração',
                dominio: '',
                isActive: true,
                azureSettings: {}
              });
              await adminTenant.save();
            }

            // 🔥 CORREÇÃO CRUCIAL: Busca o usuário por Sub OU Email
            let adminUser = await (User as any).findOne({ sub: token.sub });
            if (!adminUser) {
              adminUser = await (User as any).findOne({ email: token.email });
            }

            if (adminUser) {
              // 🔥 SE O TENANT ESTIVER ERRADO, CORRIGE IMEDIATAMENTE
              if (adminUser.tenantId !== adminTenant._id.toString()) {
                adminUser.tenantId = adminTenant._id.toString();
                adminUser.onboardingCompleted = true;
                adminUser.isActive = true;
                await adminUser.save();
              }
            } else {
              adminUser = new User({
                sub: token.sub,
                email: token.email,
                name: token.name,
                tenantId: adminTenant._id.toString(),
                onboardingCompleted: true,
                isActive: true,
              });
              await adminUser.save();
            }

            token.tenantId = adminTenant._id.toString();
            token.isActive = true;
            token.onboardingCompleted = true;
            token.azureSettings = adminTenant.azureSettings || {};
            token.impersonating = false;
            return token;
          }

          // ========================================================
          // 4. Login de USUÁRIOS NORMAIS (Com lógica de domínio)
          // ========================================================
          const emailDomain = token.email?.split('@')[1];
          let targetTenantId = 'pending';
          let tenantIsActive = false;
          let tenantAzureSettings = {};

          if (emailDomain) {
            let tenant = await Tenant.findOne({ dominio: emailDomain });
            if (!tenant) {
              tenant = new Tenant({
                uuid: crypto.randomUUID(),
                name: emailDomain,
                dominio: emailDomain,
                isActive: false,
                azureSettings: {},
              });
              await tenant.save();
              tenantIsActive = false;
            } else {
              tenantIsActive = tenant.isActive ?? false;
              tenantAzureSettings = tenant.azureSettings || {};
            }
            targetTenantId = tenant._id.toString();
          }

          let dbUser = await (User as any).findOne({ sub: token.sub });
          if (!dbUser && token.email) {
            dbUser = await (User as any).findOne({ email: token.email });
            if (dbUser) {
              dbUser.sub = token.sub;
              await dbUser.save();
            }
          }
          if (!dbUser) {
            dbUser = new User({
              sub: token.sub,
              email: token.email,
              name: token.name,
              tenantId: targetTenantId,
              onboardingCompleted: false,
              isActive: true,
            });
            await dbUser.save();
          } else {
            if (dbUser.tenantId === 'pending' || dbUser.tenantId !== targetTenantId) {
              dbUser.tenantId = targetTenantId;
              await dbUser.save();
            }
          }

          token.tenantId = dbUser.tenantId;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.isActive = tenantIsActive;
          token.azureSettings = tenantAzureSettings;
          token.impersonating = false;
        }
        return token;
      },
      async session({ session, token }) {
        if (token && session.user) {
          session.user.id = token.sub!;
          session.user.tenantId = token.tenantId as string;
          session.user.onboardingCompleted = token.onboardingCompleted as boolean;
          session.user.isActive = token.isActive as boolean;
          session.user.impersonating = token.impersonating as boolean;
          session.user.azureSettings = token.azureSettings;
          session.user.isAdmin = token.isAdmin as boolean;
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
    session: {
      strategy: "jwt",
    },
  };
}

export async function getServerAuthSession() {
  const config = await getAuthOptions();
  return getServerSession(config);
}