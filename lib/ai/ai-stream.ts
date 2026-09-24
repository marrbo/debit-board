// ============================================================
// Parser SSE reutilizável — consome responses text/event-stream
// no formato `data: {json}\n\n` usado pelas rotas de IA do app.
// ============================================================

export interface SSEChunk {
  content?: string;
  error?: string;
}

export interface ConsumeSSEOptions {
  /** Chamado a cada chunk de texto recebido do stream. */
  onChunk: (text: string) => void;
  /** Chamado uma única vez quando o servidor envia `data: [DONE]`. */
  onDone?: () => void;
  /** Chamado se o servidor enviar um frame com `{ error }` ou se o fetch falhar. */
  onError?: (err: Error) => void;
  /** AbortSignal para cancelar a leitura (ex: botão "Parar"). */
  signal?: AbortSignal;
}

/**
 * Consome uma Response SSE e despacha cada `content` para `onChunk`.
 *
 * Formato esperado de cada frame:
 *   data: {"content":"..."}\n\n
 *   data: {"error":"..."}\n\n
 *   data: [DONE]\n\n
 *
 * Lança exceção em erros de rede/abort — o chamador decide como reagir.
 * Erros enviados pelo servidor via `{ error }` são propagados por `onError`
 * (se fornecido) e também lançados, para não serem silenciados.
 */
export async function consumeSSE(
  res: Response,
  { onChunk, onDone, onError, signal }: ConsumeSSEOptions,
): Promise<void> {
  if (!res.body) {
    const err = new Error("Resposta SSE sem body");
    onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleAbort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") {
          onDone?.();
          return;
        }

        let json: SSEChunk;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }

        if (json.error) {
          const err = new Error(json.error);
          onError?.(err);
          throw err;
        }
        if (json.content) onChunk(json.content);
      }
    }
  } finally {
    signal?.removeEventListener("abort", handleAbort);
    reader.releaseLock?.();
  }
}
