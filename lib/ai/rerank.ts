// lib/ai/rerank.ts
import { tokenize } from "./text";
import { streamChat } from "@/lib/ollama";

export interface RankableDoc {
  title?: string;
  content: string;
  score: number;
}

// ============================================================
// Cross-encoder opt-in via env var
// ============================================================
const RERANK_MODEL = process.env.OLLAMA_RERANK_MODEL || "";
const RERANK_ENABLED = RERANK_MODEL.length > 0;
const RERANK_BATCH_MAX = 8;

/**
 * Indica se o rerank por cross-encoder está habilitado.
 * O caller pode pular o buffering extra quando `false`.
 */
export function isCrossEncoderEnabled(): boolean {
  return RERANK_ENABLED;
}

/**
 * Pontua um lote de passagens de uma só vez, pedindo ao modelo uma
 * lista de scores separados por vírgula, na mesma ordem dos trechos.
 *
 * Uma única chamada de chat em vez de N chamadas — reduz latência e CPU.
 * O `num_predict` é limitado proporcionalmente ao tamanho do lote.
 *
 * @param query - Query original do usuário.
 * @param passages - Trechos a pontuar (já truncados pelo caller).
 * @returns Array de scores no intervalo [0, 10] na ordem dos trechos.
 */
async function scoreBatch(
  query: string,
  passages: string[],
): Promise<number[]> {
  const block = passages
    .map((p, i) => `PASSAGE ${i + 1}:\n${p.slice(0, 500)}\n`)
    .join("\n");

  const prompt = `You are a relevance scorer. Rate each passage from 0 to 10 based on how well it answers the QUERY.

QUERY: ${query}

${block}

Output ONLY comma-separated scores in the same order as the passages.
No explanations, no labels. Example for 3 passages: 7,3,9

Scores:`;

  let raw = "";
  try {
    for await (const chunk of streamChat([{ role: "user", content: prompt }], {
      temperature: 0,
      num_predict: passages.length * 4 + 8,
    })) {
      raw += chunk;
    }
  } catch (err) {
    console.warn("[rerank] scoreBatch falhou:", (err as Error).message);
    return passages.map(() => 0);
  }

  const nums = raw.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return passages.map((_, i) => {
    const n = nums[i];
    if (!n) return 0;
    const v = parseFloat(n.replace(",", "."));
    return Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
  });
}

/**
 * Reordena candidatos usando o cross-encoder (LLM com prompt de scoring).
 *
 * Limita a `RERANK_BATCH_MAX` passagens por chamada para evitar estourar
 * contexto e perder qualidade. Quando há mais candidatos que o limite,
 * só os `RERANK_BATCH_MAX` melhores pelo cosine são reordenados.
 */
async function rerankWithModel<T extends RankableDoc>(
  docs: T[],
  query: string,
  topK: number,
): Promise<T[]> {
  const slice = docs.slice(0, RERANK_BATCH_MAX);
  if (slice.length === 0) return [];

  const scores = await scoreBatch(
    query,
    slice.map((d) => d.content),
  );

  const scored = slice.map((doc, i) => ({ doc, relevance: scores[i] }));
  scored.sort((a, b) => b.relevance - a.relevance);

  return scored.slice(0, topK).map((s) => s.doc);
}

// ============================================================
// Heurístico (fallback)
// ============================================================

/**
 * Reordena candidatos do cosine por sobreposição de tokens com a query.
 *
 * Critérios em ordem:
 *  1. Nº de tokens únicos da query (≥4 chars) presentes em title + content.
 *  2. Densidade (`hits / sqrt(len/500)`) — evita favorecer docs longos.
 *  3. Score vetorial original como desempate.
 *
 * @param docs - Candidatos já pontuados pelo cosine (campo `score`).
 * @param query - Query original em linguagem natural.
 * @param topK - Quantos documentos retornar.
 * @returns Subconjunto reordenado, tamanho `topK`.
 */
export function rerankByKeywordOverlap<T extends RankableDoc>(
  docs: T[],
  query: string,
  topK: number,
): T[] {
  const queryTokens = new Set(tokenize(query).filter((t) => t.length >= 4));

  const scored = docs.map((d) => {
    const haystack = `${d.title ?? ""} ${d.content}`.toLowerCase();
    let hits = 0;
    for (const t of queryTokens) {
      if (haystack.includes(t)) hits++;
    }
    const density = hits / Math.sqrt(Math.max(1, haystack.length / 500));
    return { doc: d, overlap: hits, density };
  });

  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    if (b.density !== a.density) return b.density - a.density;
    return b.doc.score - a.doc.score;
  });

  return scored.slice(0, topK).map((s) => s.doc);
}

// ============================================================
// Fachada
// ============================================================

/**
 * Reordena candidatos. Usa o cross-encoder quando `OLLAMA_RERANK_MODEL`
 * está definido; caso contrário, cai para a heurística keyword-overlap.
 *
 * @param docs - Candidatos já ranqueados por cosine.
 * @param query - Query original.
 * @param topK - Quantos retornar.
 * @returns Lista reordenada.
 */
export async function rerank<T extends RankableDoc>(
  docs: T[],
  query: string,
  topK: number,
): Promise<T[]> {
  if (RERANK_ENABLED && docs.length > 0) {
    try {
      return await rerankWithModel(docs, query, topK);
    } catch (err) {
      console.warn(
        "[rerank] cross-encoder falhou, caindo para heurístico:",
        (err as Error).message,
      );
    }
  }
  return rerankByKeywordOverlap(docs, query, topK);
}
