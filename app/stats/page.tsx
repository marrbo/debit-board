import { Suspense } from 'react';
import { getStats } from './services/statsService';
import StatsClient from './StatsClient';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { getObservations } from './services/observationsService';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  // Buscar dados iniciais (sem filtro)
  const [stats] = await Promise.all([
    getStats(),
    getObservations({ page: 1, limit: 10 }),
  ]);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StatsClient
        initialStats={stats}
      />
    </Suspense>
  );
}