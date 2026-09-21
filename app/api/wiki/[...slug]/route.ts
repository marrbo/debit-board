import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerAuthSession } from '@/lib/auth-server';

/**
 * Lista recursos do endpoint /api/wiki/{slug}.
 *
 * Este endpoint expõe a operação get em /api/wiki/{slug}.
 *
 * @summary Lista recursos do endpoint /api/wiki/{slug}
 * @tags Wiki, Slug
 * @route GET /api/wiki/{slug}
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(_: Request, props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params;

  const slugPath = params.slug.join('/');
  const filePath = path.join(process.cwd(), 'content', 'wiki', `${slugPath}.md`);
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  return NextResponse.json({ content });
}

/**
 * Atualiza recurso do endpoint /api/wiki/{slug}.
 *
 * Este endpoint expõe a operação put em /api/wiki/{slug}.
 *
 * @summary Atualiza recurso do endpoint /api/wiki/{slug}
 * @tags Wiki, Slug
 * @route PUT /api/wiki/{slug}
 * @async
 * @function PUT
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function PUT(request: Request, props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params;
  // Ajuste aqui para usar sua função async
  const session = await getServerAuthSession();

  // Garantia de segurança: Apenas Admin Global pode salvar
  if (session?.user?.isAdmin !== true) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { content } = await request.json();
  const slugPath = params.slug.join('/');
  const filePath = path.join(process.cwd(), 'content', 'wiki', `${slugPath}.md`);

  const dirName = path.dirname(filePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return NextResponse.json({ success: true });
}