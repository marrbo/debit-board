"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface WikiEditorProps {
  slug: string;
  initialContent: string;
}

export default function WikiEditor({ slug, initialContent }: WikiEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wiki/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        let msg = "Erro ao salvar a página.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }

      router.push(`/wiki/${slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
      <div className="h-14 border-b bg-white dark:bg-zinc-800 px-6 flex items-center justify-between shrink-0">
        <h2 className="text-sm px-2 font-medium text-zinc-500">
          Editando:{" "}
          <span className="text-zinc-900 dark:text-white">{slug}</span>
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 border border-default dark:border-strong text-heading dark:text-heading px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 border border-brand text-brand px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

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
            <MarkdownRenderer content={content} />
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-4 right-4 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-lg text-sm shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}
