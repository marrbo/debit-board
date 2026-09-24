// app/wiki/[...slug]/page.tsx
import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/api-auth";
import WikiViewer from "./_WikiViewer";
import WikiEditor from "./_WikiEditor";

const WIKI_DIR = path.join(process.cwd(), "content", "wiki");

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function WikiPage({ params, searchParams }: PageProps) {
  const { slug: slugParts } = await params;
  const { edit } = await searchParams;

  const slug = slugParts.join("/");

  const auth = await requireSession();
  if (auth.ok === false) notFound();

  const isAdmin = auth.user.isAdmin === true;

  if (slug === "admin" || slug.startsWith("admin/")) {
    if (!isAdmin) notFound();
  }

  if (slug === "_dev" || slug.startsWith("_dev/")) {
    if (!isAdmin) notFound();
    if (process.env.NODE_ENV !== "development") notFound();
  }

  const fullPath = path.resolve(WIKI_DIR, `${slug}.md`);
  if (!fullPath.startsWith(path.resolve(WIKI_DIR) + path.sep)) notFound();

  let content: string;
  try {
    content = await fs.readFile(fullPath, "utf-8");
  } catch {
    notFound();
  }

  const editing = isAdmin && edit === "true";

  return editing ? (
    <WikiEditor slug={slug} initialContent={content} />
  ) : (
    <WikiViewer slug={slug} content={content} isAdmin={isAdmin} />
  );
}
