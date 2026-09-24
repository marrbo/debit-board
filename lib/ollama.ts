// lib/ollama.ts
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.2";

export interface ChatOptions {
  temperature?: number;
  top_p?: number;
  repeat_penalty?: number;
  num_predict?: number;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embedding error: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

export async function* streamChat(
  messages: { role: string; content: string }[],
  options: ChatOptions = {},
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: true,
      keep_alive: "2h",
      options: {
        temperature: 0.1,
        top_p: 0.8,
        repeat_penalty: 1.15,
        ...options,
      },
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {}
    await res.body?.cancel();
    throw new Error(`Ollama HTTP ${res.status}: ${detail || res.statusText}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) yield json.message.content;
      } catch {}
    }
  }
}
