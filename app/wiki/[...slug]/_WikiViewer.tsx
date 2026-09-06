'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { SquarePen } from 'lucide-react';

export default function WikiViewer({ slug, content, isAdmin = false }: { slug: string, content: string, isAdmin?: boolean }) {
  return (
    <div className="w-full mx-auto p-6 px-12">
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/wiki/${slug}?edit=true`}
            className="inline-flex items-center gap-1.5 text-apple-tertiary-dark hover:text-apple-blue px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-apple-blue/30"
          >
            <SquarePen className="w-6 h-6" />
          </Link>
        </div>
      )}
      
      {/* ⚡ Correção do Preview: prose padrão e dark:prose-invert */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      </div>
    </div>
  );
}