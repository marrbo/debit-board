import { serverFetch } from '@/lib/serverFetch';
import type { IObservation } from '@/models/Observation';

export interface ObservationsResponse {
  observations: IObservation[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export async function getObservations(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ObservationsResponse> {
  const urlParams = new URLSearchParams();
  if (params.search) urlParams.set('search', params.search);
  if (params.page) urlParams.set('page', params.page.toString());
  if (params.limit) urlParams.set('limit', params.limit.toString());

  const data = await serverFetch<ObservationsResponse>(`/api/observations?${urlParams.toString()}`, {
    cache: 'no-store',
  });
  return data;
}