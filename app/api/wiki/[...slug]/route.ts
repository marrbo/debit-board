import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { slug: string[] } }) {
  const slugPath = params.slug.join('/');
  const filePath = path.join(process.cwd(), 'content', 'wiki', `${slugPath}.md`);
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  return NextResponse.json({ content });
}

export async function PUT(request: Request, { params }: { params: { slug: string[] } }) {
  // Ajuste aqui para usar sua função async
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  
  // Garantia de segurança: Apenas Admin Global pode salvar
  if (session?.user?.tenantId !== 'tenant_admin') {
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