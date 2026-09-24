// components/ai/AIChatModal.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Bot,
  Atom,
  Square,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
  Brain,
  Cpu,
  CircuitBoard,
  Lightbulb,
  Maximize2,
  Minimize2,
  RadioTower,
  SatelliteDish,
} from "lucide-react";
import { consumeSSE } from "@/lib/ai/ai-stream";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import UserAvatar from "@/components/UserAvatar";

const THINKING_ICONS = [
  Atom,
  Bot,
  Sparkles,
  RadioTower,
  SatelliteDish,
  Brain,
  Cpu,
  Lightbulb,
  CircuitBoard,
] as const;

const MAX_HISTORY = 6;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
  title?: string;
  teamName?: string;
  projectName?: string;
  repositoryName?: string;
}

export default function AIChatModal({
  isOpen,
  onClose,
  context = "general",
  title = "Assistente IA",
  teamName,
  projectName,
  repositoryName,
}: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [userCopiedIndex, setUserCopiedIndex] = useState<number | null>(null);
  const [thinkTick, setThinkTick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, expanded]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (
      !isOpen &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isStreaming) {
      setThinkTick(0);
      return;
    }
    const id = setInterval(() => setThinkTick((t) => t + 1), 700);
    return () => clearInterval(id);
  }, [isStreaming]);

  const ThinkingIcon = THINKING_ICONS[thinkTick % THINKING_ICONS.length];

  const appendToLast = useCallback((text: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + text };
      return copy;
    });
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const speak = useCallback(
    (text: string, index: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      if (speakingIndex === index) {
        window.speechSynthesis.cancel();
        setSpeakingIndex(null);
        return;
      }
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.rate = 1.05;
      utter.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const ptVoice =
        voices.find((v) => v.lang === "pt-BR") ||
        voices.find((v) => v.lang.toLowerCase().startsWith("pt"));
      if (ptVoice) utter.voice = ptVoice;

      utter.onend = () => setSpeakingIndex(null);
      utter.onerror = () => setSpeakingIndex(null);

      setSpeakingIndex(index);
      window.speechSynthesis.speak(utter);
    },
    [speakingIndex],
  );

  const copyAssistantMessage = useCallback(
    async (text: string, index: number) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      } catch {}
    },
    [],
  );

  const copyUserMessage = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setUserCopiedIndex(index);
      setTimeout(() => setUserCopiedIndex(null), 2000);
    } catch {}
  }, []);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || isStreaming) return;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
    }

    // Histórico ANTES de adicionar a pergunta atual
    const history = messages
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          context,
          teamName,
          projectName,
          repositoryName,
          history,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await consumeSSE(res, {
        onChunk: appendToLast,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        appendToLast(`\n\n> ⚠️ ${(err as Error).message}`);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [
    input,
    isStreaming,
    context,
    teamName,
    projectName,
    repositoryName,
    messages,
    appendToLast,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-[padding] duration-200 ${
        expanded ? "pl-16" : "p-4"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full flex flex-col overflow-hidden border border-default bg-elevated shadow-2xl transition-all duration-200 ${
          expanded
            ? "max-w-none h-screen rounded-none"
            : "max-w-3xl h-[85vh] rounded-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-default shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-4 h-4 text-brand shrink-0" />
            <h2 className="text-sm font-bold text-heading truncate">{title}</h2>
            <span className="text-[10px] text-muted font-mono shrink-0">
              (foco: {context}
              {teamName ? ` · ${teamName}` : ""})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Restaurar" : "Expandir"}
              title={expanded ? "Restaurar (Esc)" : "Expandir"}
              className="p-1.5 rounded-md text-muted hover:text-brand hover:bg-surface transition-colors"
            >
              {expanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
              className="p-1.5 rounded-md text-muted hover:text-error transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted mt-8">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Pergunte qualquer coisa sobre o DebitBoard.
              <br />O assistente consulta a Wiki, o banco e os resumos do
              sistema.
            </div>
          )}

          {messages.map((m, i) => {
            const isLastAssistant =
              m.role === "assistant" && i === messages.length - 1;
            const isThinking = isLastAssistant && isStreaming && !m.content;
            const isSpeaking = speakingIndex === i;
            const hasContent = m.content.trim().length > 0;
            const isUserCopied = userCopiedIndex === i;
            const isAssistantCopied = copiedIndex === i;

            if (m.role === "user") {
              return (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div className="flex gap-3 items-end justify-end max-w-[80%]">
                    <div className="text-xs rounded-lg px-3 py-2 whitespace-pre-wrap break-words bg-brand text-white">
                      {m.content}
                    </div>
                    <UserAvatar size={24} shape="circle" />
                  </div>
                  <button
                    type="button"
                    onClick={() => copyUserMessage(m.content, i)}
                    title={isUserCopied ? "Copiado" : "Copiar pergunta"}
                    aria-label={isUserCopied ? "Copiado" : "Copiar pergunta"}
                    className="p-1 rounded-md text-muted hover:text-brand hover:bg-surface transition-colors mr-9"
                  >
                    {isUserCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              );
            }

            return (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center bg-brand/10 mt-0.5">
                  {isStreaming && isLastAssistant ? (
                    <ThinkingIcon className="w-3.5 h-3.5 text-brand" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-brand" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="rounded-lg px-4 py-3 bg-surface text-body border border-default/50">
                    {isThinking ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <ThinkingIcon className="w-3 h-3 text-brand" />
                        Pensando…
                      </span>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-2 prose-code:before:content-none prose-code:after:content-none">
                        <MarkdownRenderer content={m.content} />
                        {isStreaming && isLastAssistant && (
                          <span className="inline-block w-1.5 h-3 ml-0.5 bg-brand align-middle animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>

                  {hasContent && !isThinking && (
                    <div className="flex items-center gap-1 mt-1.5 ml-1">
                      <button
                        type="button"
                        onClick={() => copyAssistantMessage(m.content, i)}
                        title={
                          isAssistantCopied ? "Copiado" : "Copiar resposta"
                        }
                        aria-label={
                          isAssistantCopied ? "Copiado" : "Copiar resposta"
                        }
                        className="p-1 rounded-md text-muted hover:text-brand hover:bg-surface transition-colors"
                      >
                        {isAssistantCopied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => speak(m.content, i)}
                        title={isSpeaking ? "Parar leitura" : "Ouvir resposta"}
                        aria-label={
                          isSpeaking ? "Parar leitura" : "Ouvir resposta"
                        }
                        className={`p-1 rounded-md transition-colors ${
                          isSpeaking
                            ? "text-brand bg-brand/10"
                            : "text-muted hover:text-brand hover:bg-surface"
                        }`}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 items-end p-3 border-t border-default shrink-0">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo... (Enter envia, Shift+Enter nova linha)"
            rows={expanded ? 2 : 1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-default bg-surface px-3 py-2 text-xs text-body placeholder:text-muted outline-none focus:border-[var(--border-focus)] transition-colors"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              title="Parar"
              className="p-2 rounded-lg text-error bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim()}
              title="Enviar"
              className="p-2 rounded-lg bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
