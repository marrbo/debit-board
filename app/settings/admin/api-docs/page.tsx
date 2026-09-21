"use client";

import { useEffect, useState } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

const LOADING_STEPS = [
  "Identificando rotas...",
  "Gerando Json...",
  "Gerando Yaml",
  "Renderizando template...",
  "Gerando Padrão OpenAPI…",
];

const LOADING_INTERVAL_MS = 2_000;

export default function ApiDocsPage() {
  const theme = useResolvedTheme();
  const [spec, setSpec] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    fetch("/api/openapi.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setSpec)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (spec || error) return;

    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % LOADING_STEPS.length);
    }, LOADING_INTERVAL_MS);

    return () => clearInterval(id);
  }, [spec, error]);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Erro ao carregar a especificação: {error}
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-center gap-5">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-body">{LOADING_STEPS[stepIndex]}</span>
      </div>
    );
  }

  return (
    <div className="-m-8">
      <ApiReferenceReact
        configuration={{
          content: spec,
          theme: "default",
          darkMode: theme === "dark",
          layout: "modern",
          hideDownloadButton: false,
          searchHotKey: "k",
          persistAuth: true,
          telemetry: false,
          hideDarkModeToggle: true,
          slug: "debit-board-openapi",
        }}
      />
    </div>
  );
}
