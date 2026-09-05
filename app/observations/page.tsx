import { Suspense } from 'react';
import ObservationsClient from './ObservationsClient';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { getServerAzureSettings } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export default async function ObservationsPage() {
  const azureSettings = await getServerAzureSettings();

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ObservationsClient azureSettings={azureSettings} />
    </Suspense>
  );
}
