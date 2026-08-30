import { serverFetch } from '@/lib/serverFetch';

export async function getSavedQueries(
  signal?: AbortSignal,
): Promise<SavedQueryItem[]> {
  try {
    const data = await serverFetch<SavedQueryItem[] | null>('/api/saved-queries', {
      signal,
    });

    if (!data || !Array.isArray(data)) {
      throw new Error('Resposta inválida da API de consultas salvas');
    }

    return data.filter((q) => q.visibility !== 'temporary');
  } catch (error: any) {
    if (error?.cause?.status === 401) {
      // Opcional: redirecionar ou lançar erro específico
      throw new Error('Não autenticado');
    }
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Erro ao carregar consultas', { cause: error });
  }
}