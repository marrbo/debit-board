import path from 'path';
import { getWikiTree } from '@/lib/wiki-utils';
import { WikiSidebar } from '@/components/wiki/WikiSidebar';

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const wikiPath = path.join(process.cwd(), 'content', 'wiki');
  const tree = getWikiTree(wikiPath);

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-200">
      {/* Área do menu - sem largura fixa, o componente controla */}
      <div className="shrink-0 h-full">
        <WikiSidebar items={tree} />
      </div>
      {/* Área de conteúdo */}
      <main className="flex-1 h-full overflow-y-auto bg-page text-heading dark:text-heading transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}