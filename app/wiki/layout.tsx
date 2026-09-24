import path from "path";
import { requireSession } from "@/lib/api-auth";
import { getWikiTree } from "@/lib/wiki-utils";
import { WikiSidebar } from "@/components/wiki/WikiSidebar";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireSession();
  const isAdmin = auth.ok === true && auth.user.isAdmin === true;
  const isDev = process.env.NODE_ENV === "development";

  const wikiPath = path.join(process.cwd(), "content", "wiki");
  const tree = getWikiTree(wikiPath, {
    includeDev: isAdmin && isDev,
    includeAdmin: isAdmin,
  });

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-200">
      <div className="shrink-0 h-full">
        <WikiSidebar items={tree} isAdmin={isAdmin} />
      </div>
      <main className="flex-1 h-full overflow-y-auto bg-page text-heading dark:text-heading transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}
