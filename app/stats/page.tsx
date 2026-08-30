import { Suspense } from 'react';
import { getStats } from './services/statsService';
import StatsClient from './StatsClient';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { getObservations } from './services/observationsService';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  // Buscar dados iniciais (sem filtro)
  const [stats, observationsData] = await Promise.all([
    getStats(),
    getObservations({ page: 1, limit: 10 }),
  ]);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StatsClient
        initialStats={stats}
        initialObservations={observationsData.observations}
        initialTotal={observationsData.total}
        initialTotalPages={observationsData.totalPages}
        initialPage={1}
        initialPageSize={10}
      />
    </Suspense>
  );
}