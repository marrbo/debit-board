'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

export default function WikiViewer({ slug, content, isAdmin }: { slug: string, content: string, isAdmin: boolean }) {
  return (
    <div className="max-w-4xl mx-auto p-4">
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Link
            href={`/wiki/${slug}?edit=true`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white text-sm rounded-lg shadow-sm transition-colors"
          >
            ✏️ Editar Página
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