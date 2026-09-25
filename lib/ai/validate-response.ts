// lib/ai/validate-response.ts

/**
 * Normaliza um número textual para forma canônica comparável.
 *
 * Lida com ambiguidades pt-BR (`1.234,56`) e en-US (`1,234.56`):
 * - Ambos separadores presentes → ponto é milhar, vírgula é decimal.
 * - Só vírgula: se à direita tem 3 dígitos e à esquerda ≤3 → milhar;
 *   caso contrário, vírgula é decimal (`1,56` → `1.56`).
 * - Só ponto: mesma heurística.
 *
 * @param n - Número textual bruto.
 * @returns Forma canônica (`"1234.56"`, `"42"`, etc).
 */
export function normalizeNumber(n: string): string {
  const hasComma = n.includes(",");
  const hasDot = n.includes(".");

  if (hasComma && hasDot) {
    return n.replace(/\./g, "").replace(",", ".");
  }

  if (hasComma) {
    const parts = n.split(",");
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      return n.replace(/,/g, "");
    }
    return n.replace(",", ".");
  }

  if (hasDot) {
    const parts = n.split(".");
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      return n.replace(/\./g, "");
    }
    return n;
  }

  return n;
}

/**
 * Extrai todos os números de um texto, na forma canônica.
 * Remove duplicatas? Não — a frequência importa para o ratio.
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d[\d.,]*\b/g) ?? [];
  return matches.map(normalizeNumber).filter((n) => n.length > 0);
}

export interface ValidationResult {
  valid: boolean;
  totalNumbers: number;
  mismatched: string[];
  ratio: number;
  reason?: string;
}

/**
 * Valida os números da resposta do LLM contra os números do contexto.
 *
 * Regras:
 *  - Respostas com ≤2 números são sempre válidas (texto puro).
 *  - Se o ratio de números ausentes no contexto ultrapassa `threshold`,
 *    a resposta é considerada alucinada e o caller deve usar o fallback.
 *
 * @param response - Texto completo gerado pelo LLM.
 * @param context - Contexto (live + documentação) que alimentou o LLM.
 * @param threshold - Fração tolerada de números ausentes (default 0.4).
 * @returns Resultado com contagem, lista de números divergentes e ratio.
 */
export function validateResponse(
  response: string,
  context: string,
  threshold = 0.4,
): ValidationResult {
  const responseNumbers = extractNumbers(response);
  const contextNumbers = new Set(extractNumbers(context));

  if (responseNumbers.length <= 2) {
    return {
      valid: true,
      totalNumbers: responseNumbers.length,
      mismatched: [],
      ratio: 0,
    };
  }

  const mismatched = responseNumbers.filter((n) => !contextNumbers.has(n));
  const ratio = mismatched.length / responseNumbers.length;

  return {
    valid: ratio <= threshold,
    totalNumbers: responseNumbers.length,
    mismatched,
    ratio,
    reason:
      ratio > threshold
        ? `${mismatched.length}/${responseNumbers.length} números da resposta não constam no contexto`
        : undefined,
  };
}

/**
 * Extrai o conteúdo do bloco `[[COPY]]…[[/COPY]]`, sem as tags.
 * Retorna `null` quando o bloco não existe.
 */
export function extractCopyBlock(text: string): string | null {
  const m = text.match(/\[\[COPY\]\]([\s\S]*?)\[\[\/COPY\]\]/);
  return m ? m[1].trim() : null;
}

/**
 * Remove todos os blocos `[[COPY]]` / `[[ANALYZE]]` e suas tags,
 * deixando apenas o conteúdo factual puro. Usado no `directStream` e
 * como fallback quando a validação falha.
 */
export function stripAugmentationTags(text: string): string {
  return text
    .replace(/\[\[\/?COPY\]\]/g, "")
    .replace(/\[\[\/?ANALYZE\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\n_\[FIM[^\]]*\]_\s*$/, "")
    .trimEnd();
}
