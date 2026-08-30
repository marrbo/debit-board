import { redirect } from 'next/navigation';
import fs from 'fs';
import path from 'path';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function WikiRootPage() {
  const indexPath = path.join(process.cwd(), 'content', 'wiki', 'index.md');
  // Só redireciona se o arquivo realmente existir. 
  // Se não existir, a tela carregará o layout com a sidebar vazia.
  if (fs.existsSync(indexPath)) {
    redirect('/wiki/index');
  }
  
  // Se estiver vazio, mostra uma mensagem amigável
  return (
    <div className="p-8 text-center text-muted-foreground">
      <h1 className="text-2xl font-bold mb-4">Wiki não inicializada</h1>
      <p>Execute <code>npm run setup-wiki</code> no terminal para gerar a estrutura inicial de arquivos.</p>
    </div>
  );
}