import type { IAzureSettings } from '@/types/IAzureSettings';
import { getServerAuthSession } from './auth-server';

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