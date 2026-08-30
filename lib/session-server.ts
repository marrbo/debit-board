import type { IAzureSettings } from '@/models/Tenant';
import { getServerAuthSession } from './auth';

export async function getServerSessionIds(): Promise<{
  userId: string;
  tenantId: string;
  azureSettings?: IAzureSettings;
}> {
  const session = await getServerAuthSession();
  return {
    userId: session?.user?.id || '',
    tenantId: session?.user?.tenantId || '',
    azureSettings: session?.user?.azureSettings,
  };
}