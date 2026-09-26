// app/api/ai/rag/route.ts
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { streamChat } from "@/lib/ollama";
import AiEmbedding from "@/models/AiEmbedding";
import { buildLiveContext } from "@/lib/ai/live-context";
import { Team } from "@/models/Team";
import { getCachedEmbedding } from "@/lib/ai/embedding-cache";
import { buildKeywordRegex } from "@/lib/ai/text";
import { rerank } from "@/lib/ai/rerank";
import {
  validateResponse,
  extractCopyBlock,
  stripAugmentationTags,
} from "@/lib/ai/validate-response";

const IDENTITY_SOURCE = "identity";
const OPENAPI_SOURCE = "openapi";
const STATIC_TOP_K = 5;
const STATIC_TOP_K_WITH_LIVE = 3;

const TYPING_CHUNK_SIZE = 24;
const TYPING_DELAY_MS = 12;

const REFUSAL = "Não encontrei essa informação na documentação do DebitBoard.";
const MIN_CONTENT_BEFORE_REFUSAL = 40;
const MIN_HOLD_LEN = 3;

const MAX_HISTORY = 6;

const ANALYSIS_PATTERNS = [
  /\b(analis[ea]|interprete?|coment[ea]|explique?)\b/i,
  /\bpor\s+qu[eê]\b/i,
  /\b(o\s+que\s+isso\s+significa|o\s+que\s+isso\s+indica)\b/i,
  /\b(recomend[ea]|sugir[ae]|o\s+que\s+fazer|pr[óo]ximos?\s+passos?)\b/i,
  /\b(prioriz[ea]|prioridade)\b/i,
  /\b(pior|melhor|mais\s+cr[íi]tic[ao]|mais\s+preocupante|mais\s+grave)\b/i,
];

function userAskedForAnalysis(q: string): boolean {
  return ANALYSIS_PATTERNS.some((p) => p.test(q));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function rank<T extends { embedding: number[] }>(
  docs: T[],
  q: number[],
  k: number,
): (T & { score: number })[] {
  return docs
    .map((d) => ({ ...d, score: cosine(q, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function* chunkString(text: string, size: number): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

// ============================================================
// Cache de nomes de times (5 min)
// ============================================================
let cachedTeamNames: string[] = [];
let cacheExpiry = 0;

async function getTeamNames(): Promise<string[]> {
  if (Date.now() < cacheExpiry) return cachedTeamNames;
  try {
    const teams = await Team.find(
      { isGlobal: { $ne: true } },
      { name: 1 },
    ).lean();
    cachedTeamNames = teams.map((t) => t.name).filter(Boolean);
    cacheExpiry = Date.now() + 5 * 60_000;
  } catch {
    cachedTeamNames = [];
  }
  return cachedTeamNames;
}

// ============================================================
// Filtros de stream
// ============================================================
class RefusalFilter {
  private pending = "";
  private sentLength = 0;
  private done = false;

  push(chunk: string): string {
    if (this.done) return "";
    const combined = this.pending + chunk;
    const idx = combined.indexOf(REFUSAL);

    if (idx !== -1) {
      const before = combined.slice(0, idx).replace(/[\s_*]+$/, "");
      const hasRealContent =
        this.sentLength + before.length > MIN_CONTENT_BEFORE_REFUSAL;

      this.done = true;
      this.pending = "";

      if (hasRealContent) {
        return before ? `${before}\n` : "";
      }
      return combined;
    }

    const maxHold = Math.min(REFUSAL.length - 1, combined.length);
    let holdLen = 0;
    for (let l = maxHold; l >= MIN_HOLD_LEN; l--) {
      const suffix = combined.slice(-l);
      if (REFUSAL.startsWith(suffix)) {
        holdLen = l;
        break;
      }
    }

    const emit = combined.slice(0, combined.length - holdLen);
    this.pending = combined.slice(combined.length - holdLen);
    this.sentLength += emit.length;
    return emit;
  }

  flush(): string {
    if (this.done) return "";
    this.done = true;
    const out = this.pending;
    this.pending = "";
    return out;
  }
}

class TeamWordFilter {
  private buffer = "";
  private readonly aggressive: boolean;
  private readonly strictPattern: RegExp | null;
  private readonly aggressivePattern: RegExp | null;
  private readonly holdBack = 24;

  constructor(teamNames: string[], aggressive: boolean) {
    this.aggressive = aggressive;

    if (aggressive) {
      this.aggressivePattern = /\btempos?\b(?!\s+real)/gi;
      this.strictPattern = null;
    } else if (teamNames.length > 0) {
      const escaped = teamNames.map((n) =>
        n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      );
      this.strictPattern = new RegExp(
        `\\btempos?\\b(?=[\\s*_]+(?:${escaped.join("|")})\\b)`,
        "gi",
      );
      this.aggressivePattern = null;
    } else {
      this.strictPattern = null;
      this.aggressivePattern = null;
    }
  }

  private replace(text: string): string {
    let result = text;
    let fired = false;

    if (this.aggressivePattern) {
      result = result.replace(this.aggressivePattern, (m) => {
        fired = true;
        return m.toLowerCase() === "tempos" ? "times" : "time";
      });
    } else if (this.strictPattern) {
      result = result.replace(this.strictPattern, () => {
        fired = true;
        return "time";
      });
    }

    if (fired) {
      console.log(
        `[TeamWordFilter] tempo(s) → time(s) (${this.aggressive ? "agressivo" : "estrito"})`,
      );
    }
    return result;
  }

  push(chunk: string): string {
    if (!this.aggressivePattern && !this.strictPattern) return chunk;
    this.buffer += chunk;

    if (this.buffer.length <= this.holdBack) return "";

    let cut = this.buffer.length - this.holdBack;

    const searchRe = this.aggressive
      ? /\btempos?\b|tempor?|temp|tem|te/gi
      : /\btempos?\b/gi;

    let m: RegExpExecArray | null;
    while ((m = searchRe.exec(this.buffer)) !== null) {
      if (m.index < cut && cut < m.index + 30) {
        cut = m.index;
        break;
      }
    }

    while (
      cut > 0 &&
      /[\w*_]/.test(this.buffer[cut - 1]) &&
      /[\w*_]/.test(this.buffer[cut])
    ) {
      cut--;
    }

    if (cut <= 0) return "";

    const emit = this.buffer.slice(0, cut);
    this.buffer = this.buffer.slice(cut);
    return this.replace(emit);
  }

  flush(): string {
    if (!this.aggressivePattern && !this.strictPattern) return "";
    const out = this.replace(this.buffer);
    this.buffer = "";
    return out;
  }
}

const SYSTEM_PROMPT = `Você é o assistente do DebitBoard.

Se houver <dados_tempo_real>, use-o como fonte de verdade dos números.

REGRAS:

- Tudo entre [[COPY]]…[[/COPY]] é dado factual LITERAL. Copie sem
  reformular, sem trocar rótulos de números e sem recalcular.
- Blocos [[ANALYZE]]…[[/ANALYZE]] são espaço OPCIONAL de interpretação:
  use SOMENTE se o usuário pedir análise, prioridade, recomendação ou
  comparação valorativa. Caso contrário, ignore o bloco inteiro.
- NUNCA invente números. Se não estiver em [[COPY]], não escreva.
- "Time" (equipe) NÃO é "tempo" (duração). Escreva sempre "time".
- NÃO invente endpoints, rotas ou métodos HTTP.
- NÃO formate respostas de dados como "MÉTODO /rota".
- Se — e somente se — o contexto não contiver a informação pedida,
  responda unicamente: ${REFUSAL}

Nunca escreva SQL. DBQL é \`propriedade:valor\` com dois-pontos.`;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Recupera os chunks estáticos mais relevantes para a query.
 *
 * Pipeline em três camadas:
 *  1. **Pré-filtro no Mongo** por tokens únicos (≥4 chars) em title/content.
 *  2. **Cosine** in-memory sobre os candidatos.
 *  3. **Rerank** (cross-encoder se habilitado; heurístico por padrão).
 *
 * @param query - Query do usuário.
 * @param queryEmbedding - Embedding já calculado (cacheado).
 * @param excludedSources - Fontes a excluir do retrieval.
 * @param k - Quantos chunks retornar após o rerank.
 * @returns Array de chunks com `source`, `title`, `content`.
 */
async function retrieveStaticChunks(
  query: string,
  queryEmbedding: number[],
  excludedSources: string[],
  k: number,
) {
  const baseFilter: Record<string, unknown> = {
    source: { $nin: excludedSources },
  };

  const keywordRegex = buildKeywordRegex(query, 4);
  const preDocs = keywordRegex
    ? await AiEmbedding.find({
        ...baseFilter,
        $or: [
          { title: { $regex: keywordRegex, $options: "i" } },
          { content: { $regex: keywordRegex, $options: "i" } },
        ],
      })
        .limit(500)
        .lean()
    : [];

  const docs =
    preDocs.length >= 20
      ? preDocs
      : preDocs.concat(await AiEmbedding.find(baseFilter).limit(500).lean());

  if (docs.length === 0) return [];

  const ranked = rank(docs, queryEmbedding, Math.max(k * 2, 10));
  return rerank(ranked, query, k);
}

/**
 * @openapi
 * /api/ai/rag:
 *   post:
 *     summary: Consulta o assistente de IA (RAG + dados em tempo real)
 *     description: |
 *       Estratégia em três modos:
 *
 *       1. **Streaming direto** — snapshot pré-calculado entregue ao
 *          cliente sem passar pelo LLM (evita alucinação por completo).
 *       2. **LLM com dados** — resposta gerada pelo LLM a partir de
 *          snapshot + documentação, com validação numérica buffered.
 *       3. **LLM só com documentação** — sem live data.
 *
 *       **Buffered validation:** a resposta do LLM é acumulada em memória
 *       antes de ser emitida. Se ≥40% dos números não constarem no
 *       contexto, a resposta é substituída pelo bloco `[[COPY]]` literal.
 *
 *       **Tags [[COPY]]/[[ANALYZE]]:** o live-context envolve tabelas
 *       factuais em `[[COPY]]` e reserva `[[ANALYZE]]` para interpretação
 *       opcional. O system prompt obriga cópia literal do bloco COPY.
 *
 *       **Cross-encoder:** habilitado via env `OLLAMA_RERANK_MODEL`.
 *       Sem essa variável, usa-se rerank heurístico por keyword overlap.
 *     tags:
 *       - AI
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, example: 'resumo executivo do time GEPIN' }
 *               context: { type: string, default: general }
 *               teamName: { type: string }
 *               projectName: { type: string }
 *               repositoryName: { type: string }
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     responses:
 *       200:
 *         description: Stream SSE.
 *       400:
 *         description: Query ausente.
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       423:
 *         description: Sem tenant.
 *       500:
 *         description: Ollama indisponível.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    query,
    context: contextLabel = "general",
    history = [],
  } = body as {
    query: string;
    context?: string;
    history?: HistoryMessage[];
  };

  if (!query) {
    return new Response(JSON.stringify({ error: "Query obrigatória" }), {
      status: 400,
    });
  }

  await connectToDatabase();

  const historyArr = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  const isFollowUp =
    query.trim().split(/\s+/).length < 8 && historyArr.length > 0;
  const lastUserMsg = [...historyArr].reverse().find((m) => m.role === "user");

  let live: Awaited<ReturnType<typeof buildLiveContext>> = {
    context: "",
    sections: [],
  };
  let usedFollowUp = false;

  try {
    live = await buildLiveContext(query);
  } catch (err) {
    console.error("[rag] buildLiveContext falhou:", err);
  }

  if (live.context.length === 0 && isFollowUp && lastUserMsg) {
    const effectiveQuery = `${lastUserMsg.content} ${query}`;
    try {
      live = await buildLiveContext(effectiveQuery);
      usedFollowUp = true;
    } catch (err) {
      console.error("[rag] buildLiveContext (follow-up) falhou:", err);
    }
  }

  const wantsAnalysis = userAskedForAnalysis(query);
  const directStream = live.context.length > 0 && !wantsAnalysis;
  const teamNames = await getTeamNames();
  const teamScope = live.sections.some((s) => /time|comparativo/i.test(s));

  console.log(
    `[rag] q="${query.slice(0, 50)}" ctx=${contextLabel} mode=${directStream ? "direct" : "llm"} live=[${live.sections.join(", ")}] analysis=${wantsAnalysis} history=${historyArr.length}${usedFollowUp ? " followup" : ""}`,
  );

  // ============================================================
  // Modo 1 — streaming direto (sem LLM): entrega o snapshot puro
  // ============================================================
  if (directStream) {
    const cleanContext = stripAugmentationTags(live.context);

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for (const piece of chunkString(cleanContext, TYPING_CHUNK_SIZE)) {
            controller.enqueue(
              enc.encode(`data: ${JSON.stringify({ content: piece })}\n\n`),
            );
            await sleep(TYPING_DELAY_MS);
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ============================================================
  // Modos 2/3 — LLM (com validação buffered)
  // ============================================================
  const queryEmbedding = await getCachedEmbedding(query);

  const identityDocs = await AiEmbedding.find({
    source: IDENTITY_SOURCE,
  }).lean();
  const identity = rank(identityDocs, queryEmbedding, 2)
    .map((c) => c.content)
    .join("\n\n");

  const isApiIntent = live.sections.some((s) => /endpoint/i.test(s));
  const excludeOpenApi = live.context.length > 0 && !isApiIntent;
  const excludedSources = excludeOpenApi
    ? [IDENTITY_SOURCE, OPENAPI_SOURCE]
    : [IDENTITY_SOURCE];

  const staticK = live.context ? STATIC_TOP_K_WITH_LIVE : STATIC_TOP_K;
  const staticChunks = await retrieveStaticChunks(
    query,
    queryEmbedding,
    excludedSources,
    staticK,
  );

  const staticContext = staticChunks
    .map((c) => `[${c.source}] ${c.title}\n${c.content}`)
    .join("\n\n---\n\n");

  const userMessage = `<identidade>
${identity}
</identidade>

<documentacao>
${staticContext || "(vazio)"}
</documentacao>${
    live.context
      ? `\n\n<dados_tempo_real>\n${live.context}\n</dados_tempo_real>`
      : ""
  }

<pergunta>
${query}
</pergunta>`;

  const historyMessages = historyArr.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let finished = false;

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ content: text })}\n\n`),
        );
      };

      try {
        // ---- 1. Bufferiza a resposta completa do LLM ----
        let raw = "";
        for await (const chunk of streamChat(messages)) {
          if (finished) continue;

          const idx = chunk.indexOf("[FIM");
          if (idx !== -1) {
            raw += chunk.slice(0, idx).replace(/[_*]+\s*$/, "");
            finished = true;
            break;
          }
          raw += chunk;
        }

        // ---- 2. Aplica filtros pós-processamento no buffer inteiro ----
        const refusalFilter = new RefusalFilter();
        const teamWordFilter = new TeamWordFilter(teamNames, teamScope);

        const afterRefusal = refusalFilter.push(raw);
        const afterTeam = teamWordFilter.push(afterRefusal);
        let finalText =
          afterTeam + teamWordFilter.flush() + refusalFilter.flush();

        // ---- 3. Validação numérica buffered ----
        if (live.context) {
          const validation = validateResponse(finalText, live.context);
          if (!validation.valid) {
            console.warn(
              `[rag] validação falhou (${validation.reason}); usando fallback [[COPY]]`,
            );
            const copyBlock = extractCopyBlock(live.context);
            finalText = copyBlock ?? stripAugmentationTags(live.context);
          }
        }

        // ---- 4. Emite o texto final em chunks (animação) ----
        for (const piece of chunkString(finalText, TYPING_CHUNK_SIZE)) {
          emit(piece);
          await sleep(TYPING_DELAY_MS);
        }

        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[rag] erro:", msg);
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
