// lib/auth-server.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-options";
import { connectToDatabase } from "./mongodb";
import { Tenant } from "@/models/Tenant";
import { cookies } from "next/headers";
import type { IAzureSettings } from "@/types/IAzureSettings";
import { getServerSessionIds } from "./session-server";
import mongoose from "mongoose";

export async function getServerAuthSession() {
  return await getServerSession(authOptions);
}

export async function getServerAzureSettings() {
  const session = await getServerSessionIds();
  const tenantIdRaw = session?.tenantId;

  const tenantId = mongoose.Types.ObjectId.isValid(tenantIdRaw)
          ? new mongoose.Types.ObjectId(tenantIdRaw)
          : null;
  
  if (!tenantIdRaw) return null;

  try {
      await connectToDatabase();
      const tenant = await Tenant.findById(tenantId).lean();
      return tenant?.azureSettings as IAzureSettings;
  } catch (error) {
    console.error("Erro ao buscar Azure Settings:", error);
    return null;
  }
}

export async function getImpersonationCookie() {
  const cookieStore = await cookies();
  return cookieStore.get("impersonating_user")?.value;
}