import fs from 'fs';
import path from 'path';
import { getServerAuthSession } from '@/lib/auth';
import WikiViewer from './_WikiViewer';
import WikiEditor from './_WikiEditor';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
;

export default async function WikiPage(
  props: { 
    params: Promise<{ slug: string[] }>, 
    searchParams: Promise<{ edit?: string }> 
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerAuthSession();
  const isAdmin: boolean = session?.user?.isAdmin || false;

  // 🔍 DEBUG: Se você não estiver vendo o botão, olhe no terminal do servidor para ver o que está vindo na sessão
  console.log('🔍 Sessão detectada pelo Servidor:', session?.user?.email, 'Role:', session?.user?.tenantId);

  const slugPath = params.slug.join('/');
  const filePath = path.join(process.cwd(), 'content', 'wiki', `${slugPath}.md`);

  if (!fs.existsSync(filePath)) {
    return <div className="p-8 text-red-500 text-center">Página não encontrada.</div>;
  }

  if (searchParams.edit === 'true' && isAdmin) {
    return <WikiEditor slug={slugPath} />;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return <WikiViewer slug={slugPath} content={content} isAdmin={isAdmin} />;
}