import type { IAzureSettings } from "@/types/IAzureSettings";
import { getServerAuthSession } from "./auth-server";
import mongoose from "mongoose";

export async function getServerSessionIds(): Promise<{
  userId: string;
  tenantId: mongoose.Types.ObjectId;
  azureSettings?: IAzureSettings;
}> {
  const session = await getServerAuthSession();
  const tenantIdRaw = session?.user?.tenantId;
  const tenantId = mongoose.Types.ObjectId.isValid(tenantIdRaw)
    ? new mongoose.Types.ObjectId(tenantIdRaw)
    : null;

  return {
    userId: session?.user?.sub || "",
    tenantId: tenantId,
    azureSettings: session?.user?.azureSettings,
  };
}
