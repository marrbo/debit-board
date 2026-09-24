"use client";

import Link from "next/link";
import { SquarePen } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export default function WikiViewer({
  slug,
  content,
  isAdmin = false,
}: {
  slug: string;
  content: string;
  isAdmin?: boolean;
}) {
  return (
    <div className="w-full mx-auto p-8 pl-20">
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/wiki/${slug}?edit=true`}
            className="text-muted fixed hover:text-brand rounded-lg text-xs font-medium transition-colors"
            title="Editar página"
            aria-label="Editar página"
          >
            <SquarePen className="w-6 h-6" />
          </Link>
        </div>
      )}

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
