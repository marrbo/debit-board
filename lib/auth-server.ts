// lib/auth-server.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-options";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import { cookies } from "next/headers";
import type { IAzureSettings } from "@/types/IAzureSettings";

export async function getServerAuthSession() {
  return await getServerSession(authOptions);
}

export async function getServerAzureSettings() {
  const session = await getServerAuthSession();

  if (!session?.user?.tenantId) return null;

  try {
    await connectToDatabase();
    const tenant = await Tenant.findById(session.user.tenantId).lean();
    return tenant?.azureSettings as IAzureSettings | null;
  } catch (error) {
    console.error("Erro ao buscar Azure Settings:", error);
    return null;
  }
}

export async function getImpersonationCookie() {
  const cookieStore = await cookies();
  return cookieStore.get("impersonating_user")?.value;
}