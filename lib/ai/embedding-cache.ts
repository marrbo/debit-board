// lib/ai/embedding-cache.ts
import { generateEmbedding } from "@/lib/ollama";
import { normalize } from "./text";

const MAX_ENTRIES = 200;
const TTL_MS = 15 * 60_000;

interface CacheEntry {
  embedding: number[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Retorna o embedding de uma query, usando cache em memória.
 *
 * A chave é o texto normalizado (minúsculas, sem acentos), então variações
 * triviais reaproveitam a mesma entrada. Entradas expiram em 15 min e o
 * cache é limitado a 200 itens (eviction FIFO).
 *
 * @param query - Texto da query do usuário.
 * @returns Vetor de embedding pronto para cosine.
 */
export async function getCachedEmbedding(query: string): Promise<number[]> {
  const key = normalize(query);

  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    // Refresh LRU: move para o fim
    cache.delete(key);
    cache.set(key, hit);
    return hit.embedding;
  }

  const embedding = await generateEmbedding(query);

  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }

  cache.set(key, { embedding, expiresAt: Date.now() + TTL_MS });
  return embedding;
}
