'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function WikiEditor({ slug }: { slug: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o conteúdo da API de forma segura
  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/wiki/${slug}`);

        // Se a resposta não for OK, tenta extrair mensagem de erro
        if (!res.ok) {
          let errorMsg = `Erro ${res.status}`;
          try {
            const data = await res.json();
            if (data?.error) errorMsg = data.error;
          } catch {
            // corpo não é JSON, mantém mensagem genérica
          }
          throw new Error(errorMsg);
        }

        // Tenta fazer parse do JSON com segurança
        const text = await res.text();
        if (!text) {
          setContent('');
          return;
        }

        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('Resposta inválida da API (não é JSON).');
        }

        setContent(data?.content || '');
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Erro ao carregar conteúdo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wiki/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        let errorMsg = 'Erro ao salvar a página.';
        try {
          const data = await res.json();
          if (data?.error) errorMsg = data.error;
        } catch {}
        throw new Error(errorMsg);
      }

      router.push(`/wiki/${slug}`); // Volta para a visualização
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar.');
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-center">Carregando...</div>;

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Barra de Ferramentas */}
      <div className="h-14 border-b bg-white dark:bg-zinc-800 px-6 flex items-center justify-between shrink-0">
        <h2 className="text-sm px-2 font-medium text-zinc-500">
          Editando: <span className="text-zinc-900 dark:text-white">{slug}</span>
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-tertiary-light/30"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 border border-apple-blue text-apple-blue px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors outline-none focus:ring-2 focus:ring-apple-blue/30"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Área Split */}
      <div className="flex flex-1 overflow-hidden px-2">
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
            <MarkdownRenderer content={content}></MarkdownRenderer>
          </div>
        </div>
      </div>

      {/* Mensagens de erro (opcional) */}
      {error && (
        <div className="absolute bottom-4 right-4 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-xl text-sm shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}