// instrumentation.ts
import * as Sentry from "@sentry/nextjs";
import { EventEmitter } from "node:events";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "development") {
      EventEmitter.defaultMaxListeners = 25;
    }

    await import("./sentry.server.config");

    const { connectToDatabase } = await import("@/lib/mongodb");
    const { startIngestion } = await import("@/lib/ai/ingest");

    try {
      await connectToDatabase();
      await startIngestion();
    } catch (err) {
      console.error("[instrumentation] falha ao iniciar ingest:", err);
    }

    // Warmup do Ollama: força o carregamento do modelo uma vez no boot,
    // com keep_alive longo. Assim a primeira pergunta real do usuário
    // não paga o custo de reload (30-60s de CPU).
    const warmup = async () => {
      const OLLAMA = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.2";
      try {
        await fetch(`${OLLAMA}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            prompt: "ok",
            stream: false,
            keep_alive: "2h",
            options: { num_predict: 1 },
          }),
        });
        console.log(`[instrumentation] ollama warmup concluído (${MODEL})`);
      } catch (err) {
        console.warn("[instrumentation] ollama warmup falhou:", err);
      }
    };

    warmup();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
