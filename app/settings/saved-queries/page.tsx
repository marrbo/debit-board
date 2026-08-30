import { Suspense } from 'react';
import { getSavedQueries } from './services/savedQueriesService';
import SavedQueriesClient from './SavedQueriesClient';
import LoadingSkeleton from '@/components/LoadingSkeleton';

export const dynamic = 'force-dynamic'; // não cachear

export default async function SavedQueriesPage() {
  // Busca dados no servidor
  const queries = await getSavedQueries();

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SavedQueriesClient initialQueries={queries} />
    </Suspense>
  );
}