// app/api/wiki/[...slug]/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { reconcileWiki } from "@/lib/ai/ingest";

const WIKI_DIR = path.join(process.cwd(), "content", "wiki");

function resolveSafe(slugParts: string[]): string | null {
  const slug = slugParts.join("/");
  if (!slug || slug.includes("..")) return null;
  if (!/^[\w\-./]+$/.test(slug)) return null;

  const full = path.resolve(WIKI_DIR, `${slug}.md`);
  if (!full.startsWith(path.resolve(WIKI_DIR) + path.sep)) return null;
  return full;
}

interface RouteContext {
  params: Promise<{ slug: string[] }>;
}

/**
 * @openapi
 * /api/wiki/{slug}:
 *   get:
 *     summary: Lê o conteúdo de uma página da Wiki
 *     description: |
 *       Retorna o conteúdo markdown de um arquivo `.md` em `content/wiki/`.
 *
 *       **Validação de path:** o `slug` é resolvido e confirmado dentro do
 *       diretório da Wiki. Tentativas de path traversal (`..`) ou caracteres
 *       fora de `[\w\-./]` retornam 400.
 *     tags:
 *       - Wiki
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Caminho relativo do arquivo, sem extensão `.md`.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: simple
 *         explode: false
 *         example: user-guide/dbql/1.Syntax
 *     responses:
 *       200:
 *         description: Conteúdo da página.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [content]
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Conteúdo markdown completo.
 *       400:
 *         description: Caminho inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 *       404:
 *         description: Página não encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { slug: slugParts } = await params;

  const full = resolveSafe(slugParts);
  if (!full) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  try {
    const content = await fs.readFile(full, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: "Página não encontrada." },
      { status: 404 },
    );
  }
}

/**
 * @openapi
 * /api/wiki/{slug}:
 *   put:
 *     summary: Atualiza o conteúdo de uma página existente da Wiki
 *     description: |
 *       Substitui o conteúdo do arquivo `.md` correspondente ao `slug`.
 *       O arquivo **precisa existir** — para criar páginas novas use
 *       `POST /api/wiki/create`.
 *
 *       Após persistir no filesystem, dispara em background um reindex do
 *       arquivo para o assistente de IA (via `after()` do Next.js).
 *     tags:
 *       - Wiki
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: Caminho relativo do arquivo, sem extensão `.md`.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: simple
 *         explode: false
 *         example: user-guide/dbql/1.Syntax
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: Novo conteúdo markdown completo.
 *     responses:
 *       200:
 *         description: Arquivo salvo. Reindex disparado em background.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Caminho inválido ou `content` não-string.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 *       401:
 *         description: Sessão ausente ou inválida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       403:
 *         description: Sem permissão de admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 *       404:
 *         description: Página não encontrada (PUT não cria).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 *       423:
 *         description: Usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const { slug: slugParts } = await params;

  const full = resolveSafe(slugParts);
  if (!full) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  const { content } = await req.json();
  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "Content deve ser string." },
      { status: 400 },
    );
  }

  try {
    await fs.access(full);
  } catch {
    return NextResponse.json(
      { error: "Página não encontrada." },
      { status: 404 },
    );
  }

  await fs.writeFile(full, content, "utf-8");

  const relPath = `${slugParts.join("/")}.md`;
  after(async () => {
    try {
      await connectToDatabase();
      await reconcileWiki(relPath);
    } catch (err) {
      console.error("[wiki PUT] reindex falhou:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
