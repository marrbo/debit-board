'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function WikiEditor({ slug }: { slug: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carrega o conteúdo da API
  useEffect(() => {
    fetch(`/api/wiki/${slug}`)
      .then((res) => res.json())
      .then((data) => setContent(data.content || ''))
      .finally(() => setIsLoading(false));
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/wiki/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) {
      router.push(`/wiki/${slug}`); // Volta para a visualização (sem o ?edit)
    } else {
      alert('Erro ao salvar a página.');
    }
  };

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Barra de Ferramentas */}
      <div className="h-14 border-b bg-white dark:bg-zinc-800 px-6 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-zinc-500">Editando: <span className="text-zinc-900 dark:text-gray-900 dark:text-white">{slug}</span></h2>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Área Split */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-zinc-200 dark:border-zinc-700 flex flex-col bg-[#fafafa] dark:bg-[#1e1e1e]">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
            spellCheck={false}
          />
        </div>
        <div className="w-1/2 overflow-y-auto p-8 bg-white dark:bg-zinc-900">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}