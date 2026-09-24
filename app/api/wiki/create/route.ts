import { NextRequest, NextResponse, after } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { reconcileWiki } from "@/lib/ai/ingest";

const WIKI_DIR = path.join(process.cwd(), "content", "wiki");

function resolveSafe(input: string): { full: string; slug: string } | null {
  const slug = String(input ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!slug || slug.includes("..")) return null;
  if (!/^[\w\-./]+$/.test(slug)) return null;

  const full = path.resolve(WIKI_DIR, `${slug}.md`);
  if (!full.startsWith(path.resolve(WIKI_DIR) + path.sep)) return null;

  return { full, slug };
}

/**
 * @openapi
 * /api/wiki/create:
 *   post:
 *     summary: Cria uma nova página na Wiki
 *     description: |
 *       Cria um arquivo `.md` em `content/wiki/` a partir do caminho
 *       informado. Subpastas intermediárias são criadas automaticamente
 *       (`mkdir -p`).
 *
 *       **Validação de path:** o `path` é rejeitado se contiver `..`,
 *       caracteres fora de `[\w\-./]`, ou se o path resolvido escapar do
 *       diretório da Wiki.
 *
 *       **Conflito:** se já existir um arquivo no caminho informado, a rota
 *       retorna 409 — para atualizar páginas existentes use
 *       `PUT /api/wiki/{slug}`.
 *
 *       **Conteúdo inicial:** se `content` for omitido ou vazio, a página é
 *       criada com um cabeçalho `# <nome-da-última-seção>`.
 *
 *       Após persistir, dispara em background um reindex do arquivo para o
 *       assistente de IA.
 *     tags:
 *       - Wiki
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path]
 *             properties:
 *               path:
 *                 type: string
 *                 description: |
 *                   Caminho relativo do arquivo sem a extensão `.md`.
 *                   Use `/` para separar segmentos de subpastas.
 *                 example: user-guide/dbql/4.Limits
 *               content:
 *                 type: string
 *                 description: |
 *                   Conteúdo markdown inicial. Se omitido, um cabeçalho
 *                   `# <nome>` é inserido automaticamente.
 *                 example: "# Limits\n\nDescreva aqui os limites do sistema.\n"
 *     responses:
 *       200:
 *         description: Página criada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, slug]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 slug:
 *                   type: string
 *                   description: Caminho relativo normalizado (sem `.md`).
 *                   example: user-guide/dbql/4.Limits
 *       400:
 *         description: |
 *           `path` ausente, caminho inválido, ou tentativa de path traversal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 *             example:
 *               error: Caminho inválido.
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
 *       409:
 *         description: Já existe uma página no caminho informado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WikiError'
 *             example:
 *               error: Já existe uma página nesse caminho.
 *       423:
 *         description: Sessão válida, mas usuário sem tenant associado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthError'
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const { path: slugInput, content = "" } = await req.json();
  const resolved = resolveSafe(slugInput);
  if (!resolved) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  const { full, slug } = resolved;

  const exists = await fs
    .access(full)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    return NextResponse.json(
      { error: "Já existe uma página nesse caminho." },
      { status: 409 },
    );
  }

  const leaf = slug.split("/").pop() ?? slug;
  const initial =
    content && content.trim().length > 0 ? content : `# ${leaf}\n\n`;

  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, initial, "utf-8");

  after(async () => {
    try {
      await connectToDatabase();
      await reconcileWiki(`${slug}.md`);
    } catch (err) {
      console.error("[wiki create] reindex falhou:", err);
    }
  });

  return NextResponse.json({ ok: true, slug });
}
