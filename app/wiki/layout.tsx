import path from 'path';
import { getWikiTree } from '@/lib/wiki-utils';
import { WikiSidebar } from '@/components/wiki/WikiSidebar';

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
;

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const wikiPath = path.join(process.cwd(), 'content', 'wiki');
  const tree = getWikiTree(wikiPath);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden transition-colors duration-200">
      
      {/* Sidebar da Wiki (Estilo Escuro Apple) */}
      <aside className="w-64 border-r border-apple-border-dark h-full overflow-y-auto p-4 bg-apple-card-dark/80 flex-shrink-0 text-apple-label-dark transition-colors">
        <div className="mb-4 px-2 font-bold text-lg text-apple-label-dark">Wiki Explorer</div>
        <WikiSidebar items={tree} />
      </aside>

      {/* 📄 ÁREA DA WIKI (Fundo Off-White Apple no claro, Preto no escuro) */}
      <main className="flex-1 px-12 h-full overflow-y-auto p-4 bg-apple-bg-light dark:bg-apple-bg-dark text-apple-label-light dark:text-apple-label-dark transition-colors duration-200">
        {children}
      </main>
      
    </div>
  );
}