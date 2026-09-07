'use client';

import Link from 'next/link';
import { SquarePen } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function WikiViewer({ slug, content, isAdmin = false }: { slug: string, content: string, isAdmin?: boolean }) {
  return (
    <div className="w-full mx-auto p-8 pl-20">
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/wiki/${slug}?edit=true`}
            className="text-apple-tertiary-dark hover:text-apple-blue rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-apple-blue/30"
          >
            <SquarePen className="w-6 h-6" />
          </Link>
        </div>
      )}
      
      {/* ⚡ Correção do Preview: prose padrão e dark:prose-invert */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <MarkdownRenderer content={content}></MarkdownRenderer>
      </div>
    </div>
  );
}