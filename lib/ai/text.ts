// lib/ai/text.ts

const ACCENTS = /[\u0300-\u036f]/g;
const NON_WORD = /[^\w\s]/g;
const SPACES = /\s+/g;

/**
 * Normaliza texto para comparação: minúsculas, sem acento, sem pontuação,
 * espaços colapsados. Estável para caching (mesma string → mesma chave).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(ACCENTS, "")
    .replace(NON_WORD, " ")
    .replace(SPACES, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Monta uma regex `token1|token2|...` a partir de tokens únicos com
 * comprimento mínimo. Retorna `null` quando não há tokens úteis
 * (query vazia ou só stopwords curtas).
 *
 * @param text - Texto de origem (normalmente a query do usuário).
 * @param minLength - Comprimento mínimo para um token entrar no filtro.
 * @returns Regex string pronta para `$regex`, ou `null`.
 */
export function buildKeywordRegex(text: string, minLength = 4): string | null {
  const unique = Array.from(
    new Set(tokenize(text).filter((t) => t.length >= minLength)),
  );
  if (unique.length === 0) return null;
  return unique.map(escapeRegex).join("|");
}
