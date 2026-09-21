"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  BookOpen,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { useSlideToggle } from "@/hooks/useLocalSettings";

type TabKey = "code" | "why" | "fix";

export default function IssueDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();

  // 🔥 Aba persistida por página (code/why/fix)
  const { value: activeTab, setValue: setActiveTab } = useSlideToggle<TabKey>(
    pathname,
    "observationTab",
    "code",
  );

  // 🔥 Tema reativo — sem MutationObserver
  const isDarkTheme = useResolvedTheme() === "dark";

  const [issue, setIssue] = useState<any>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [errorIssue, setErrorIssue] = useState<string | null>(null);

  const [snippets, setSnippets] = useState<
    { snippet: string; hitLine: number; startLine: number }[]
  >([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [errorSnippets, setErrorSnippets] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0);

  // =========================================================================
  // Carregamento da Issue
  // =========================================================================
  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;

    const loadIssue = async () => {
      setLoadingIssue(true);
      try {
        const res = await fetch(`/api/observations/${params.id}`);
        if (!res.ok) throw new Error("Erro ao carregar Observation");
        const data = await res.json();

        let found = null;
        if (data._id) found = data;
        else if (Array.isArray(data.observations))
          found = data.observations.find((i: any) => i._id === params.id);

        if (!found) throw new Error("Issue não encontrada.");
        if (!cancelled) setIssue(found);
      } catch (err: any) {
        if (!cancelled) setErrorIssue(err.message);
      } finally {
        if (!cancelled) setLoadingIssue(false);
      }
    };

    loadIssue();
    return () => {
      cancelled = true;
    };
  }, [params.id, session, status, router]);

  // =========================================================================
  // Carregamento do snippet (dispara quando a issue chega — sem abort prematuro)
  // =========================================================================
  useEffect(() => {
    if (!issue) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const loadSnippet = async () => {
      setLoadingSnippets(true);
      setErrorSnippets(null);
      setSnippets([]);

      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch(`/api/observations/${params.id}/snippet`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setSnippets(data.snippets || []);
        } else {
          setErrorSnippets(
            "Azure DevOps indisponível, não foi possível carregar o código.",
          );
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          setErrorSnippets(
            "Tempo máximo de espera excedido (30s). Azure DevOps indisponível.",
          );
        } else {
          setErrorSnippets("Erro ao carregar o trecho de código do Azure.");
        }
      } finally {
        setLoadingSnippets(false);
      }
    };

    loadSnippet();
    return () => {
      controller.abort();
    };
  }, [issue, params.id]);

  const handleRetrySnippet = () => {
    if (!issue) return;
    // Re-dispara o effect setando um novo snapshot da issue
    setIssue({ ...issue });
  };

  const getLanguageFromExtension = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      cs: "csharp",
      js: "javascript",
      ts: "typescript",
      py: "python",
      java: "java",
      go: "go",
      rb: "ruby",
      rs: "rust",
      swift: "swift",
      php: "php",
      html: "html",
      css: "css",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sh: "bash",
      bash: "bash",
      ps1: "powershell",
    };
    return map[ext || ""] || "text";
  };

  if (loadingIssue)
    return (
      <div className="flex justify-center py-12 text-muted">
        Carregando detalhes da Issue...
      </div>
    );
  if (errorIssue)
    return (
      <div className="w-full px-4 py-6 text-error">Erro: {errorIssue}</div>
    );
  if (!issue)
    return (
      <div className="text-center py-12 text-muted">Issue não encontrada.</div>
    );

  const pattern = issue.patternId || null;
  const azureUrl = `${session?.user?.azureSettings?.instanceUrl || ""}/tfs/${
    session?.user?.azureSettings?.azureCollection || ""
  }/${issue.project}/_git/${issue.repository}?path=${
    issue.filePath
  }&version=GB${issue.branch}&_a=contents`;

  const renderSnippetContent = () => {
    if (loadingSnippets) {
      return (
        <div className="flex flex-col items-center justify-center h-44 border border-default dark:border-strong rounded-lg bg-surface/50">
          <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin mb-3" />
          <p className="text-sm text-muted">
            Carregando trecho de código do Azure...
          </p>
        </div>
      );
    }

    if (errorSnippets) {
      return (
        <div className="flex flex-col items-center justify-center h-44 border border-apple-red/20 rounded-lg bg-apple-red/5 p-4 text-center">
          <p className="text-sm font-medium text-error mb-1">
            Falha ao carregar o código
          </p>
          <p className="text-xs text-muted max-w-md mx-auto mb-3">
            {errorSnippets}
          </p>
          <button
            onClick={handleRetrySnippet}
            className="inline-flex items-center gap-2 bg-brand hover:bg-[#0063CE] text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <RotateCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      );
    }

    if (snippets.length === 0) {
      return (
        <div className="text-muted text-sm mt-4 text-center py-8">
          Nenhum trecho de código disponível para esta ocorrência.
        </div>
      );
    }

    const current = snippets[activeSnippetIndex];
    return (
      <div className="w-full transition-all duration-300">
        <div className="flex items-center justify-between mb-4 text-muted">
          <span className="text-xs font-mono">
            Linhas {current?.startLine} -{" "}
            {(current?.startLine || 0) +
              (current?.snippet?.split("\n")?.length || 0) -
              1}
          </span>
          {snippets.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => setActiveSnippetIndex((i) => Math.max(0, i - 1))}
                disabled={activeSnippetIndex === 0}
                className="px-2 py-1 bg-apple-tertiary-light/10 rounded text-xs disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="text-xs self-center">
                {activeSnippetIndex + 1} / {snippets.length}
              </span>
              <button
                onClick={() =>
                  setActiveSnippetIndex((i) =>
                    Math.min(snippets.length - 1, i + 1),
                  )
                }
                disabled={activeSnippetIndex === snippets.length - 1}
                className="px-2 py-1 bg-apple-tertiary-light/10 rounded text-xs disabled:opacity-30"
              >
                Próximo
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-default dark:border-strong overflow-hidden">
          <SyntaxHighlighter
            language={getLanguageFromExtension(issue.fileName)}
            wrapLongLines
            style={isDarkTheme ? oneDark : oneLight}
            showLineNumbers
            customStyle={{
              backgroundColor: isDarkTheme ? "#0f172a" : "#f8fafc",
              padding: "1.5rem",
              fontSize: "0.875rem",
              margin: 0,
              transition: "background-color 0.2s ease",
            }}
            startingLineNumber={current?.startLine}
            lineProps={(lineNumber) => {
              const globalLine = (current?.startLine || 1) + (lineNumber - 1);
              const isHit =
                globalLine ===
                (current?.hitLine || 0) + (current?.startLine || 1) - 1;
              if (isHit) {
                return {
                  style: {
                    display: "block",
                    backgroundColor: isDarkTheme
                      ? "rgba(239, 68, 68, 0.35)"
                      : "rgba(239, 68, 68, 0.15)",
                    borderLeft: "4px solid #ef4444",
                    paddingLeft: "1rem",
                    marginLeft: "-1.5rem",
                    paddingRight: "1rem",
                    marginRight: "-1.5rem",
                  },
                };
              }
              return {};
            }}
          >
            {current?.snippet ?? ""}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mx-auto px-4 py-4 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-default dark:border-strong pb-4 mb-2">
        <div className="flex items-center gap-4">
          <Link
            href="/observations"
            className="flex items-center gap-2 text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <div className="h-6 w-px bg-apple-border-light dark:border-strong" />
          <h1 className="text-lg font-bold text-heading dark:text-heading">
            {issue.fileName}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              issue.severity === "critical"
                ? "bg-apple-red/10 text-error border border-apple-red/20"
                : issue.severity === "high"
                ? "bg-apple-orange/10 text-warning border border-apple-orange/20"
                : issue.severity === "medium"
                ? "bg-apple-yellow/10 text-warning border border-apple-yellow/20"
                : "bg-brand/10 text-brand border border-brand/20"
            }`}
          >
            {issue.severity?.toUpperCase()}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              issue.status === "open" || issue.status === "recurring"
                ? "bg-brand/10 text-brand border border-brand/20"
                : issue.status === "resolved"
                ? "bg-apple-green/10 text-success border border-apple-green/20"
                : "bg-apple-tertiary-light/10 text-muted border border-default"
            }`}
          >
            {issue.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Coluna principal */}
        <div className="w-full lg:w-[65%] space-y-8">
          <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg shadow-sm overflow-hidden">
            <div className="flex border-b border-default dark:border-strong bg-page/30 dark:bg-page/20">
              <button
                onClick={() => setActiveTab("code")}
                className={`px-5 py-3 text-xs font-medium transition-colors ${
                  activeTab === "code"
                    ? "border-b-2 border-apple-red text-error"
                    : "text-muted hover:text-heading"
                }`}
              >
                Onde está o problema?
              </button>
              <button
                onClick={() => setActiveTab("why")}
                className={`px-5 py-3 text-xs font-medium transition-colors ${
                  activeTab === "why"
                    ? "border-b-2 border-brand text-brand"
                    : "text-muted hover:text-heading"
                }`}
              >
                Por que isso é um problema?
              </button>
              <button
                onClick={() => setActiveTab("fix")}
                className={`px-5 py-3 text-xs font-medium transition-colors ${
                  activeTab === "fix"
                    ? "border-b-2 border-apple-green text-success"
                    : "text-muted hover:text-heading"
                }`}
              >
                Como corrigir?
              </button>
            </div>

            <div className="p-6">
              {activeTab === "code" && (
                <div>
                  <div className="mb-4">
                    <h4 className="font-medium text-heading text-sm mb-1">
                      Ocorrência encontrada em:
                    </h4>
                    <p className="text-xs text-muted font-mono break-all">
                      {issue.filePath}
                    </p>
                  </div>
                  {renderSnippetContent()}
                  {!loadingSnippets &&
                    !errorSnippets &&
                    snippets.length > 0 && (
                      <div className="mt-4 flex items-center justify-start gap-1.5 text-[10px] text-muted border-t border-default/50 pt-3 pl-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-success" />
                        <span>
                          Este trecho é consultado em tempo real e não é
                          armazenado.
                        </span>
                      </div>
                    )}
                </div>
              )}

              {activeTab === "why" && (
                <div className="space-y-4 text-sm leading-relaxed">
                  <BookOpen className="w-5 h-5 text-brand mb-2" />
                  <div className="prose prose-slate dark:prose-invert max-w-none min-h-[350px] max-h-[550px] overflow-auto p-3">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {pattern?.description ||
                        "Não há descrição cadastrada no sistema para este padrão."}
                    </Markdown>
                  </div>
                </div>
              )}

              {activeTab === "fix" && (
                <div className="space-y-4 text-sm leading-relaxed">
                  <BookOpen className="w-5 h-5 text-success mb-2" />
                  <div className="prose prose-slate dark:prose-invert max-w-none min-h-[362px] max-h-[550px] overflow-auto p-3">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {pattern?.recommendation ||
                        "Não há recomendação cadastrada no sistema para este padrão."}
                    </Markdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[35%] space-y-6">
          <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg p-5 shadow-sm">
            <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
              Actions
            </h3>
            <a
              href={azureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-apple-tertiary-light/10 hover:bg-apple-tertiary-light/20 py-2.5 rounded-lg text-sm font-medium text-heading transition-colors border border-default dark:border-transparent"
            >
              Ver no Azure <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg p-5 shadow-sm divide-y divide-apple-border-light/50 dark:divide-apple-border-dark/50">
            <div className="pb-4 mb-4">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
                Origem
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Project</span>
                  <span className="font-medium text-xs">{issue.project}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Repository</span>
                  <span className="font-medium text-xs truncate max-w-[50%] text-right">
                    {issue.repository}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Branch</span>
                  <span className="font-medium text-xs">{issue.branch}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-muted text-xs">Source file</span>
                  <span className="font-mono text-right text-xs w-2/3 break-all bg-page/30 px-2 py-0.5 rounded">
                    {issue.filePath.split("/").pop().trim()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
                Metadata
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Category</span>
                  <span className="font-medium text-xs">{issue.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Hits</span>
                  <span className="font-medium text-xs text-warning">
                    {issue.hitCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">SLA</span>
                  <span className="font-medium text-xs">{issue.slaHours}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted text-xs">Created</span>
                  <span className="font-medium text-xs">
                    {formatDistanceToNow(new Date(issue.firstSeen), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                {pattern?.externalId && pattern?.externalLink && (
                  <div className="flex justify-between items-center border-t border-default/50 pt-2 mt-2">
                    <span className="text-muted text-xs">External ID</span>
                    <a
                      href={pattern.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand hover:text-brand/80 text-xs font-medium max-w-[50%] text-right break-all"
                    >
                      {pattern.externalId}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
