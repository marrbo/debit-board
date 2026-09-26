// app/api/ai/dbql-generate/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/ollama";
import { requireSession } from "@/lib/api-auth";

const DBQL_FIELDS: Record<string, string> = {
  observations:
    "category, severity (critical|high|medium|low), branch, project, repository, status (open|resolved|recurring|wont_fix|expired), is (is:unresolved), fileName",
  projects: "name, description, isActive, teamId",
  repositories: "name, projectId, isActive",
};

const SYSTEM_PROMPT = `Você é um gerador determinístico de DBQL (Debit Board Query Language).

REGRA ABSOLUTA: retorne APENAS a string DBQL, sem explicações, sem markdown,
sem crases, sem prefixo "DBQL:" e sem comentários. Não invente operadores

SINTAXE:
- Padrão: propriedade:valor
- Valores com espaços ou caracteres especiais DEVEM usar aspas duplas: category:"Broken Access Control"
- Operadores: AND, OR, NOT, !, ( )
- Operador NOT ou ! possuem resultado igual
- Wildcard: fileName:*Controller.cs
- Precedência: ! > AND > OR. Use parênteses para agrupar.

EXEMPLOS:
- "critical no projeto X"           → severity:critical AND project:X
- "críticas ou altas"               → severity:critical OR severity:high
- "não resolvidas do time GEPIN"    → project:GEPIN AND status:open
- "arquivos Controller.cs"          → fileName:*Controller.cs
- "arquivo AuthController.cs"       → fileName:AuthController.cs
- "todos arquivos que contém Help"  → fileName:*Help*
- "críticas do GEPIN ou do GDSAF"   → severity:critical AND (project:GEPIN OR project:GDSAF)

NUNCA invente operadores.
NUNCA invente valores de enum. Se o pedido citar algo fora da lista, escolha o mais próximo.`;

/**
 * Gera uma query DBQL a partir de linguagem natural.
 *
 * Usa o mesmo modelo local (`streamChat`) do assistente RAG, mas com um
 * system prompt estrito que força saída apenas da string DBQL.
 *
 * @summary Gera DBQL via LLM local
 * @tags AI, DBQL
 * @route POST /api/ai/dbql-generate
 * @async
 * @function POST
 * @param {NextRequest} req - Corpo: `{ naturalLanguage: string, context: string }`.
 * @returns {Promise<NextResponse>} `{ query: string }` ou `{ error }`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    naturalLanguage?: string;
    context?: string;
  };

  const naturalLanguage = (body.naturalLanguage ?? "").trim();
  const context = (body.context ?? "observations").trim();

  if (!naturalLanguage) {
    return NextResponse.json(
      { error: "Descrição em linguagem natural é obrigatória." },
      { status: 400 },
    );
  }

  const fields = DBQL_FIELDS[context] ?? DBQL_FIELDS.observations;

  let raw = "";
  try {
    for await (const chunk of streamChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Contexto: ${context}\nCampos disponíveis: ${fields}\n\nPedido: ${naturalLanguage}`,
        },
      ],
      { temperature: 0.05, num_predict: 200 },
    )) {
      raw += chunk;
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao gerar DBQL: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Remove cercas markdown, prefixos comuns e quebras, mantém só a 1ª linha não vazia.
  const cleaned = raw
    .replace(/```[a-z]*/gi, "")
    .replace(/^DBQL\s*:\s*/i, "")
    .replace(/^Query\s*:\s*/i, "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));

  if (!cleaned) {
    return NextResponse.json(
      { error: "O modelo não retornou uma query válida. Tente reformular." },
      { status: 422 },
    );
  }

  return NextResponse.json({ query: cleaned });
}
