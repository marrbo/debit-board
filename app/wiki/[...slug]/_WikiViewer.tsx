'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { SquarePen } from 'lucide-react';

export default function WikiViewer({ slug, content, isAdmin = false }: { slug: string, content: string, isAdmin?: boolean }) {
  return (
    <div className="w-full mx-auto p-4">
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/wiki/${slug}?edit=true`}
            className="inline-flex items-center gap-1.5 border border-apple-blue text-apple-blue px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-blue/30"
          >
            <SquarePen className="w-4 h-4 mr-2" /> Editar
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