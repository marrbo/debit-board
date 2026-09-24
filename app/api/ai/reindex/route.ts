// app/api/ai/reindex/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import {
  reconcileAiDocs,
  reconcileWiki,
  purgeDeprecatedEmbeddings,
} from "@/lib/ai/ingest";
import { reconcileOpenApi } from "@/lib/ai/openapi-ingest";

/**
 * @openapi
 * /api/ai/reindex:
 *   post:
 *     summary: Força reindex de fontes estáticas do assistente de IA
 *     description: |
 *       Regera embeddings **estáticos** armazenados em `ai_embeddings`.
 *       Dados dinâmicos (observations, projects, teams) **não são
 *       armazenados** — eles são consultados em tempo real durante cada
 *       pergunta, via `lib/ai/live-context.ts`.
 *
 *       **Fontes estáticas reindexáveis:**
 *       - `wiki` — páginas de `content/wiki/` (via `all` ou `path`)
 *       - `identity` — `content/ai/identity.md`
 *       - `dbql` — `content/ai/dbql-cheatsheet.md`
 *       - `glossary` — `content/ai/glossary.md`
 *
 *       **Purge:** remove embeddings de fontes obsoletas ou dinâmicas
 *       legadas (`observation`, `project`, `repository`, `savedQuery`,
 *       `team-summary`, `response-format`). Use quando atualizar de uma
 *       versão anterior do pipeline.
 *     tags:
 *       - AI
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ai:
 *                 type: boolean
 *                 description: Reindexa identity, dbql e glossary.
 *                 default: false
 *               all:
 *                 type: boolean
 *                 description: Reindexa toda a Wiki (recursivo).
 *                 default: false
 *               path:
 *                 type: string
 *                 description: |
 *                   Caminho relativo de um único arquivo `.md` dentro de
 *                   `content/wiki/`. Ignorado quando `all: true`.
 *                 example: getting-started/system-overview.md
 *               purgeDeprecated:
 *                 type: boolean
 *                 description: |
 *                   Remove embeddings de fontes obsoletas
 *                   (`observation`, `project`, `repository`, `savedQuery`,
 *                   `team-summary`, `response-format`).
 *                 default: false
 *           examples:
 *             aiOnly:
 *               summary: Apenas arquivos de content/ai
 *               value: { ai: true }
 *             wikiFull:
 *               summary: Wiki inteira
 *               value: { all: true }
 *             singleFile:
 *               summary: Um arquivo da Wiki
 *               value: { path: "getting-started/quick-start.md" }
 *             cleanup:
 *               summary: Limpar embeddings obsoletos
 *               value: { purgeDeprecated: true }
 *     responses:
 *       200:
 *         description: Reindex executado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, reindexed]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 reindexed:
 *                   type: array
 *                   description: Ações efetivamente executadas.
 *                   items:
 *                     type: string
 *                   example: ["ai", "wiki:all", "purge:2317"]
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Usuário autenticado, mas sem permissão de admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       500:
 *         description: |
 *           Falha durante o reindex — geralmente erro de leitura de
 *           arquivo ou indisponibilidade do Ollama ao gerar embeddings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [error]
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'connect ECONNREFUSED 127.0.0.1:11434'
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    await connectToDatabase();

    const reindexed: string[] = [];

    if (body.purgeDeprecated) {
      const n = await purgeDeprecatedEmbeddings();
      reindexed.push(`purge:${n}`);
    }
    if (body.ai) {
      await reconcileAiDocs();
      reindexed.push("ai");
    }
    if (body.all) {
      await reconcileWiki();
      reindexed.push("wiki:all");
    } else if (body.path) {
      await reconcileWiki(body.path);
      reindexed.push(`wiki:${body.path}`);
    }

    if (body.openapi) {
      await reconcileOpenApi();
      reindexed.push("openapi");
    }

    return NextResponse.json({ ok: true, reindexed });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
