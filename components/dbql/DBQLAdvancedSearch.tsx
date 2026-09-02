// components/dbql/DBQLAdvancedSearch.tsx
"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useTransition,
  useCallback,
} from "react";
import type { CSSProperties } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Code2,
  HelpCircle,
  AlertCircle,
  BookmarkPlus,
  Bookmark,
  Check,
  Bot,
  Trash2,
  Copy,
  PlayCircleIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DBQLRichInput from "./DBQLRichInput";
import DBQLHelpModal from "./DBQLHelpModal";
import DBQLSuggestions from "./DBQLSuggestions";

// ============================================================
// Tipos e interfaces
// ============================================================
interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: "observations" | "stats" | "projects" | "repositories";
  userId: string;
  onManageQueries?: () => void;
  value?: string;
}

interface SavedQuery {
  _id: string;
  name: string;
  queryString: string;
  context: string;
  visibility: "private" | "shared" | "public" | "temporary";
  userId?: string;
}

interface ValidationError {
  error: string;
  highlightIndex: number | null;
  errorLength: number;
}

type Visibility = "private" | "shared" | "public";

const MEME_QUIPS = [
  "Houston, temos um problema lógico: 'You shall not pass!' 🧙‍♂️",
  "Inception booleana detectada: operador lógico dentro de operador.",
  "Matrix corrompida: tentar misturar tantos operadores vai acordar o Neo.",
  "Erro 418: Sou um bule de chá, mas até eu sei que essa sintaxe não faz sentido!",
  "Stack overflow de tokens: operadores encadeados demais para uma única query.",
];

// ============================================================
// Funções auxiliares
// ============================================================
const hasComplexSyntax = (q: string): boolean =>
  /[\(\)!\*]|\b(>=|<=|>|<|!=|:|=|and|or|not)\b/i.test(q);

const parseInputToTags = (input: string): string[] => {
  const regex =
    /(?:(?:and|or)\s+not\s+|(?:and|or|not)\s+)?!?[a-zA-Z0-9_]+(>=|<=|>|<|!=|:|=)(?:"[^"]*"|[^\s\(\)]+)/gi;
  const matches = input.match(regex) || [];
  return matches.map((m) => m.trim());
};

const validateDBQL = (query: string): ValidationError[] => {
  if (!query) return [];
  const errors: ValidationError[] = [];
  const tokens: string[] = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  let searchIndex = 0;
  let looseTextStart: number | null = null;
  let looseTextEnd: number | null = null;
  let looseTextContent = "";

  tokens.forEach((token) => {
    const cleanToken = token.replace(/^[\(]+|[\)]+$/g, "");
    const tokenIndex = query.indexOf(token, searchIndex);

    if (cleanToken !== "") {
      const lower = cleanToken.toLowerCase();
      const isOperator = ["and", "or", "not"].includes(lower);
      const isField = /^!?[a-zA-Z0-9_]+(>=|<=|>|<|!=|:|=)/i.test(cleanToken);
      const isParens = /^[\(\)]+$/.test(token);

      if (!isOperator && !isField && !isParens) {
        if (looseTextStart === null) {
          looseTextStart = tokenIndex;
          looseTextContent = token;
        } else {
          looseTextContent += ` ${token}`;
        }
        looseTextEnd = tokenIndex + token.length;
      } else {
        if (looseTextStart !== null && looseTextEnd !== null) {
          errors.push({
            error: `Texto solto ou sintaxe não reconhecida: "${looseTextContent}" (Termos múltiplos requerem aspas)`,
            highlightIndex: looseTextStart,
            errorLength: looseTextEnd - looseTextStart,
          });
          looseTextStart = null;
          looseTextEnd = null;
          looseTextContent = "";
        }
      }
    }
    searchIndex = tokenIndex + token.length;
  });

  if (looseTextStart !== null && looseTextEnd !== null) {
    errors.push({
      error: `Texto solto ou sintaxe não reconhecida: "${looseTextContent}" (Termos múltiplos requerem aspas)`,
      highlightIndex: looseTextStart,
      errorLength: looseTextEnd - looseTextStart,
    });
  }

  const stack: number[] = [];
  for (let i = 0; i < query.length; i++) {
    if (query[i] === "(") stack.push(i);
    else if (query[i] === ")") {
      if (stack.length > 0) stack.pop();
      else
        errors.push({
          error: "Erro de sintaxe: Parêntese fechado sem abertura correspondente.",
          highlightIndex: i,
          errorLength: 1,
        });
    }
  }
  if (stack.length > 0)
    errors.push({
      error: "Erro de sintaxe: Parêntese aberto não foi fechado.",
      highlightIndex: stack[stack.length - 1] || null,
      errorLength: 1,
    });

  if (/\(\s*\)[\)]*/.test(query)) {
    const match = query.match(/\(\s*\)/);
    errors.push({
      error: "Erro de sintaxe: Agrupamento vazio ( ).",
      highlightIndex: match?.index ?? 0,
      errorLength: match ? match[0].length : 2,
    });
  }

  let openQuote = false;
  let firstUnclosedQuote = -1;
  for (let i = 0; i < query.length; i++) {
    if (query[i] === '"') {
      openQuote = !openQuote;
      if (openQuote) firstUnclosedQuote = i;
    }
  }
  if (openQuote)
    errors.push({
      error: "Erro de sintaxe: Aspas duplas não fechadas.",
      highlightIndex: firstUnclosedQuote,
      errorLength: 1,
    });

  const chaoticRegex = /\b(and|or|not)\s+(and|or|not)\s+(and|or|not)\b/i;
  const chaoticMatch = chaoticRegex.exec(query);
  if (chaoticMatch) {
    const randomMeme =
      MEME_QUIPS[Math.floor(Math.random() * MEME_QUIPS.length)];
    errors.push({
      error: `${randomMeme} (Detectado: '${chaoticMatch[0]}')`,
      highlightIndex: chaoticMatch.index ?? 0,
      errorLength: chaoticMatch[0].length,
    });
  }

  return errors.slice(0, 3);
};

const getEditingToken = (text: string) => {
  const tokens: string[] = text
    .split(/(?=\b(?:and|or|not)\b|\s)/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const currentToken = tokens[tokens.length - 1] || "";
  const cleanToken = currentToken.replace(
    /^[\(!]+|\b(?:and\s+not|or\s+not|not|and|or)\s+/gi,
    "",
  );

  const match = cleanToken.match(/^([a-zA-Z0-9_]+)(>=|<=|>|<|!=|:|=)(.*)$/);
  if (!match) return null;
  return {
    rawToken: currentToken,
    cleanToken,
    fieldKey: match[1],
    operator: match[2],
    query: match[3]?.replace(/^"/, ""),
  };
};

// ============================================================
// Componente principal
// ============================================================
export default function DBQLAdvancedSearch({
  onSearch,
  placeholder = 'Buscar... ex: category:"Broken Access Control" and severity:high',
  context = "observations",
  userId = "",
  onManageQueries,
  value,
}: AdvancedSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [_, startTransition] = useTransition();

  // Parâmetros da URL
  const rawUrlQueryId = searchParams.get("q") || "";
  const urlModeParam = searchParams.get("m") || searchParams.get("mode");

  // ========== ESTADOS DE EDIÇÃO (o que o usuário vê/digita) ==========
  const [mode, setMode] = useState<"tags" | "advanced">("tags");
  const [inputValue, setInputValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // ========== ESTADO ATIVO (a query que está efetivamente sendo usada) ==========
  const [activeQueryString, setActiveQueryString] = useState<string>("");
  const [activeSavedQuery, setActiveSavedQuery] = useState<SavedQuery | null>(null);
  const [originalQueryString, setOriginalQueryString] = useState<string>("");

  // ========== ESTADOS DE UI ==========
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<Visibility>("private");
  const [isSavedDropdownOpen, setIsSavedDropdownOpen] = useState(false);
  const [savedDropdownStyle, setSavedDropdownStyle] = useState<CSSProperties>({});
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiNaturalInput, setAiNaturalInput] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchVisible, setIsSearchVisible] = useState(true);

  // Refs
  const savedButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastNotifiedQuery = useRef<string>("");
  const savedDropdownRef = useRef<HTMLDivElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const aiModalRef = useRef<HTMLDivElement>(null);
  const initialLoadDoneRef = useRef(false);
  const lastValueRef = useRef<string | undefined>(undefined);

  // ============================================================
  // 1. Computar a query atual (baseada no estado de edição)
  // ============================================================
  const currentEditingQuery = useMemo(() => {
    if (mode === "advanced") return inputValue;
    return [...tags, inputValue].filter(Boolean).join(" ");
  }, [mode, inputValue, tags]);

  // ============================================================
  // 2. Sincronização com valor externo (evita setState síncrono)
  // ============================================================
  useEffect(() => {
    if (value === undefined || value === lastValueRef.current) return;
    lastValueRef.current = value;

    const applyExternalValue = () => {
      if (!value) {
        setInputValue("");
        setTags([]);
        setMode("tags");
        return;
      }

      const targetMode = hasComplexSyntax(value) ? "advanced" : "tags";
      setMode(targetMode);
      if (targetMode === "advanced") {
        setInputValue(value);
        setTags([]);
      } else {
        setTags(parseInputToTags(value));
        setInputValue("");
      }
    };

    Promise.resolve().then(applyExternalValue);
  }, [value]);

  // ============================================================
  // 3. Notificar pai (evita duplicatas)
  // ============================================================
  const notifySearch = useCallback(
    (query: string) => {
      if (query !== lastNotifiedQuery.current) {
        lastNotifiedQuery.current = query;
        startTransition(() => {
          onSearch?.(query);
        });
      }
    },
    [onSearch],
  );

  // ============================================================
  // 4. Carregar da URL (efeito principal) - com microtasks
  // ============================================================
  useEffect(() => {
    const loadFromUrl = async () => {
      Promise.resolve().then(() => setIsLoading(true));

      try {
        if (rawUrlQueryId) {
          const res = await fetch(`/api/saved-queries?id=${rawUrlQueryId}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            const matched = Array.isArray(data) ? data[0] : data;
            if (matched?.queryString) {
              const query = matched as SavedQuery;
              Promise.resolve().then(() => {
                setActiveSavedQuery({
                  _id: query._id,
                  name: query.name,
                  queryString: query.queryString,
                  context: query.context || context,
                  visibility: query.visibility || "private",
                });
                setOriginalQueryString(query.queryString);
                setActiveQueryString(query.queryString);
                const targetMode = hasComplexSyntax(query.queryString) ? "advanced" : "tags";
                setMode(targetMode);
                if (targetMode === "advanced") {
                  setInputValue(query.queryString);
                  setTags([]);
                } else {
                  setTags(parseInputToTags(query.queryString));
                  setInputValue("");
                }
                notifySearch(query.queryString);
              });
              return;
            }
          }
        }

        // Sem ID ou falha: estado vazio
        Promise.resolve().then(() => {
          setActiveSavedQuery(null);
          setOriginalQueryString("");
          setActiveQueryString("");
          const initialMode =
            urlModeParam === "a" || urlModeParam === "advanced"
              ? "advanced"
              : urlModeParam === "t" || urlModeParam === "tags"
                ? "tags"
                : "tags";
          setMode(initialMode);
          setInputValue("");
          setTags([]);
          notifySearch("");
          const params = new URLSearchParams(searchParams.toString());
          if (params.has("q") || params.has("m")) {
            params.delete("q");
            params.delete("m");
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }
        });
      } catch (err) {
        console.error("Erro ao carregar query da URL:", err);
      } finally {
        Promise.resolve().then(() => setIsLoading(false));
        initialLoadDoneRef.current = true;
      }
    };

    loadFromUrl();
  }, [rawUrlQueryId, urlModeParam, pathname, router, searchParams, context, notifySearch]);

  // ============================================================
  // 5. Função para limpar (usada internamente e no botão)
  // ============================================================
  const clearAllInternal = useCallback(() => {
    setTags([]);
    setInputValue("");
    setActiveSavedQuery(null);
    setOriginalQueryString("");
    setActiveQueryString("");
    setMode("tags");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("m");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    notifySearch("");
    setIsSavedDropdownOpen(false);
    setIsOpen(false);
  }, [pathname, router, searchParams, notifySearch]);

  // ============================================================
  // 6. Função para executar a busca (clicar em Executar ou Enter)
  // ============================================================
  const executeSearch = useCallback(async () => {
    const fullQuery = currentEditingQuery;
    const currentMode = mode;

    if (!fullQuery) {
      clearAllInternal();
      return;
    }

    if (fullQuery === activeQueryString && currentMode === mode) {
      notifySearch(fullQuery);
      return;
    }

    try {
      const id = activeSavedQuery?._id || null;
      const visibility = activeSavedQuery?.visibility || "temporary";
      const name = activeSavedQuery?.name || `Temporária (${context})`;

      if (!id || visibility === "temporary") {
        const payload = {
          name,
          queryString: fullQuery,
          context,
          visibility: "temporary",
          userId,
        };
        const method = id ? "PUT" : "POST";
        const body = id ? { ...payload, id } : payload;

        const res = await fetch("/api/saved-queries", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const saved = await res.json() as SavedQuery;
          Promise.resolve().then(() => {
            setActiveSavedQuery({
              _id: saved._id,
              name: saved.name,
              queryString: saved.queryString,
              context: saved.context,
              visibility: saved.visibility,
            });
            setOriginalQueryString(saved.queryString);
            setActiveQueryString(fullQuery);
            const params = new URLSearchParams(searchParams.toString());
            params.set("q", saved._id);
            params.set("m", currentMode === "advanced" ? "a" : "t");
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            notifySearch(fullQuery);
          });
        }
      } else {
        if (fullQuery !== originalQueryString) {
          const res = await fetch("/api/saved-queries", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              name: activeSavedQuery?.name,
              queryString: fullQuery,
              context,
            }),
          });
          if (res.ok) {
            const updated = await res.json() as SavedQuery;
            Promise.resolve().then(() => {
              setActiveSavedQuery(updated);
              setOriginalQueryString(updated.queryString);
              setActiveQueryString(fullQuery);
              const params = new URLSearchParams(searchParams.toString());
              params.set("m", currentMode === "advanced" ? "a" : "t");
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              notifySearch(fullQuery);
            });
          }
        } else {
          const params = new URLSearchParams(searchParams.toString());
          const expectedMode = currentMode === "advanced" ? "a" : "t";
          if (params.get("m") !== expectedMode) {
            params.set("m", expectedMode);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }
          Promise.resolve().then(() => {
            setActiveQueryString(fullQuery);
            notifySearch(fullQuery);
          });
        }
      }
    } catch (err) {
      console.error("Erro ao persistir query:", err);
    }
  }, [
    currentEditingQuery,
    mode,
    activeSavedQuery,
    originalQueryString,
    context,
    userId,
    searchParams,
    pathname,
    router,
    notifySearch,
    activeQueryString,
  ]);

  

  // ============================================================
  // 7. Handler do botão Executar e Enter
  // ============================================================
  const handleExecuteSearch = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    executeSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mode === "tags" && inputValue.trim()) {
        const newTags = [...tags, inputValue.trim()];
        setTags(newTags);
        setInputValue("");
        executeSearch();
      } else {
        executeSearch();
      }
    } else if (
      e.key === "Backspace" &&
      mode === "tags" &&
      !inputValue &&
      tags.length > 0
    ) {
      setTags(tags.slice(0, -1));
    }
  };

  // ============================================================
  // 8. Outros handlers
  // ============================================================
  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mode === "tags") {
      const fullQuery = tags.join(" ") + (inputValue ? ` ${inputValue}` : "");
      setInputValue(fullQuery.trim());
      setMode("advanced");
    } else {
      if (hasComplexSyntax(inputValue)) {
        alert("A consulta possui sintaxes avançadas exclusivas.");
        return;
      }
      const parsed = parseInputToTags(inputValue);
      setTags(parsed);
      setInputValue("");
      setMode("tags");
    }
  };

  const clearAll = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    clearAllInternal();
  };

  // ============================================================
  // 9. Carregar lista de queries salvas
  // ============================================================
  useEffect(() => {
    const fetchSavedQueries = async () => {
      try {
        const res = await fetch(`/api/saved-queries?context=${context}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json() as SavedQuery[];
          setSavedQueries(data);
        }
      } catch (err) {
        console.error("Erro ao buscar saved queries", err);
      }
    };
    fetchSavedQueries();
  }, [context]);

  // ============================================================
  // 10. Sugestões
  // ============================================================
  const handleSuggestionSelect = (selectedValue: string) => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData) return;
    const formattedValue = selectedValue.includes(" ")
      ? `"${selectedValue}"`
      : selectedValue;
    const lastIndex = inputValue.lastIndexOf(tokenData.rawToken);

    if (lastIndex !== -1) {
      const before = inputValue.substring(0, lastIndex);
      const newRawToken = tokenData.rawToken.replace(
        tokenData.cleanToken,
        `${tokenData.fieldKey}${tokenData.operator}${formattedValue}`,
      );
      setInputValue(before + newRawToken + " ");
    }

    setIsOpen(false);
    setSuggestions([]);
    setActiveField(null);
  };

  useEffect(() => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData || !tokenData.fieldKey || tokenData.query?.includes("*")) {
      const resetTimeout = setTimeout(() => {
        setSuggestions([]);
        setIsOpen(false);
        setActiveField(null);
      }, 0);
      return () => clearTimeout(resetTimeout);
    }

    const activeFieldTimeout = setTimeout(
      () => setActiveField(tokenData.fieldKey),
      0,
    );
    if (tokenData.fieldKey.toLowerCase() === "severity") {
      const severities = ["critical", "high", "medium", "low", "info"];
      const filtered = severities.filter(
        (s) =>
          s.startsWith((tokenData.query || "").toLowerCase()) &&
          s !== tokenData.query?.toLowerCase(),
      );
      const suggestionsTimeout = setTimeout(() => {
        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      }, 0);
      return () => {
        clearTimeout(activeFieldTimeout);
        clearTimeout(suggestionsTimeout);
      };
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/observation-filters?field=${encodeURIComponent(tokenData.fieldKey || "")}&query=${encodeURIComponent(tokenData.query || "")}&context=${encodeURIComponent(context)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.from(
            new Set(data.suggestions || data.values || []),
          ).filter((item): item is string => typeof item === "string");
          const filtered = list
            .filter((item) => item.toLowerCase() !== tokenData.query?.toLowerCase())
            .slice(0, 10);
          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(activeFieldTimeout);
      clearTimeout(timeout);
    };
  }, [inputValue, context, setSuggestions, setIsOpen]);

  // ============================================================
  // 11. Salvamento e gerenciamento de queries salvas
  // ============================================================
  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || !currentEditingQuery) return;

    try {
      const res = await fetch("/api/saved-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          queryString: currentEditingQuery,
          context,
          visibility: saveVisibility,
        }),
      });
      if (res.ok) {
        const saved = await res.json() as SavedQuery;
        setActiveSavedQuery({
          _id: saved._id,
          name: saved.name,
          queryString: saved.queryString,
          context: saved.context,
          visibility: saved.visibility,
        });
        setOriginalQueryString(saved.queryString);
        setActiveQueryString(saved.queryString);
        setIsSaveModalOpen(false);
        setSaveName("");
        const params = new URLSearchParams(searchParams.toString());
        params.set("q", saved._id);
        params.set("m", mode === "advanced" ? "a" : "t");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        const listRes = await fetch(`/api/saved-queries?context=${context}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json() as SavedQuery[];
          setSavedQueries(data);
        }
        notifySearch(currentEditingQuery);
      }
    } catch (err) {
      console.error("Erro ao salvar nova query", err);
    }
  };

  const handleUpdateActiveQuery = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeSavedQuery || activeSavedQuery.visibility === "temporary") return;
    try {
      const res = await fetch("/api/saved-queries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSavedQuery._id,
          name: activeSavedQuery.name,
          queryString: currentEditingQuery,
          context,
        }),
      });
      if (res.ok) {
        const updated = await res.json() as SavedQuery;
        setActiveSavedQuery(updated);
        setOriginalQueryString(updated.queryString);
        setActiveQueryString(updated.queryString);
        const listRes = await fetch(`/api/saved-queries?context=${context}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json() as SavedQuery[];
          setSavedQueries(data);
        }
        notifySearch(currentEditingQuery);
      }
    } catch (err) {
      console.error("Erro ao atualizar query salva", err);
    }
  };

  const handleDeleteSavedQuery = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Deseja realmente excluir esta consulta salva?")) return;
    try {
      const res = await fetch(`/api/saved-queries?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeSavedQuery?._id === id) {
          clearAllInternal();
        }
        const listRes = await fetch(`/api/saved-queries?context=${context}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json() as SavedQuery[];
          setSavedQueries(data);
        }
      }
    } catch (err) {
      console.error("Erro ao excluir query salva", err);
    }
  };

  const handleToggleSavedDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSavedDropdownOpen && savedButtonRef.current) {
      const rect = savedButtonRef.current.getBoundingClientRect();
      setSavedDropdownStyle({
        position: "fixed",
        bottom: `${window.innerHeight - (rect.top + 320)}px`,
        right: `${window.innerWidth - rect.right}px`,
        width: "320px",
        zIndex: 9999,
      });
    }
    setIsSavedDropdownOpen(!isSavedDropdownOpen);
  };

  // ============================================================
  // 12. Prompt IA
  // ============================================================
  const generatedAiPromptText = `Você é um assistente especialista na Debit Board Query Language (DBQL).
Contexto atual da interface: ${context} (AdvancedQuery - DBQL).

Abaixo está a documentação técnica oficial da sintaxe DBQL para você seguir rigorosamente ao gerar consultas:

🔍 Estrutura Básica:
- Padrão: propriedade:valor
- Valores com espaços ou caracteres especiais devem ser envolvidos em aspas duplas (" "). Ex: category:"Broken Access Control"

📋 Propriedades Disponíveis:
- category: Categoria da vulnerabilidade
- severity: Severidade (critical, high, medium, low)
- branch: Nome do branch
- project: Nome do projeto
- repository: Nome do repositório
- status: Status atual (new, open, resolved, recurring, wont_fix)
- is: Filtros especiais (ex: is:unresolved)
- fileName: Nome do arquivo, suporta curingas (*)

⚙️ Operadores Lógicos e Símbolos:
- AND, OR, NOT / !
- ( ) para agrupamento
- * para Wildcard

Solicitação do usuário em linguagem natural:
"${aiNaturalInput}"

Por favor, retorne APENAS a string da consulta DBQL resultante, perfeitamente formatada e pronta para uso.`;

  // ============================================================
  // 13. Aviso de saída sem salvar
  // ============================================================
  const isModified = useMemo(() => {
    if (!activeSavedQuery) return false;
    if (activeSavedQuery.visibility === "temporary") return false;
    return currentEditingQuery !== originalQueryString;
  }, [currentEditingQuery, originalQueryString, activeSavedQuery]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isModified) {
        e.preventDefault();
        e.returnValue = "Você tem alterações não salvas. Deseja realmente sair?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isModified]);

  // ============================================================
  // 14. Renderização
  // ============================================================
  const syntaxErrors = useMemo(
    () => validateDBQL(currentEditingQuery),
    [currentEditingQuery],
  );

  const realSavedQueries = savedQueries.filter((q) => q.visibility !== "temporary");
  const isQueryModified = isModified;

  return (
    <div className="relative w-full flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setIsSearchVisible(!isSearchVisible)}
        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark shadow-sm text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 transition-colors z-20"
        title={isSearchVisible ? "Ocultar busca" : "Mostrar busca"}
        aria-label={isSearchVisible ? "Ocultar busca" : "Mostrar busca"}
      >
        {isSearchVisible ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isSearchVisible ? (
        <div
          className={`relative flex flex-col bg-white dark:bg-[#1C1C1E] border rounded-xl px-4 py-3 shadow-sm transition-none outline-none ring-0 focus-within:ring-0 focus:outline-none gap-3 ${
            syntaxErrors.length > 0
              ? "border-apple-red"
              : "border-apple-border-light dark:border-apple-border-dark"
          }`}
        >
          <div className="flex items-start gap-3 w-full">
            <Search
              className={`w-4 h-4 shrink-0 mt-2.5 ${syntaxErrors.length > 0 ? "text-apple-red" : "text-apple-tertiary-light"}`}
            />

            <div className="flex flex-col flex-1 gap-1.5 min-w-0">
              {mode === "tags" && tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-[13px] bg-white dark:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark px-2 py-1 rounded-md border border-apple-border-light dark:border-apple-border-dark shadow-sm font-mono font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(idx)}
                        className="text-apple-tertiary-light hover:text-apple-red transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative w-full min-h-[44px]">
                <DBQLRichInput
                  value={inputValue}
                  onChange={setInputValue}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  rows={2}
                  className="!bg-transparent !border-none !p-0 shadow-none py-1.5 px-0 z-10"
                />

                <DBQLSuggestions
                  isOpen={isOpen}
                  suggestions={suggestions}
                  activeField={activeField}
                  onSelect={handleSuggestionSelect}
                  onClose={() => setIsOpen(false)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-apple-border-light dark:border-apple-border-dark text-xs">
            <div className="text-[11px] text-apple-tertiary-light flex items-center gap-2">
              {(tags.length > 0 || inputValue) && (
                <div className="flex items-center gap-1.5 mr-5">
                  <button
                    type="button"
                    onClick={handleExecuteSearch}
                    disabled={syntaxErrors.length > 0}
                    className="text-apple-tertiary-light hover:text-apple-green transition-colors flex items-center gap-1 ml-1 disabled:opacity-40 disabled:hover:text-apple-tertiary-light"
                  >
                    <PlayCircleIcon className="w-3 h-3" />
                    <span>Executar</span>
                  </button>
                </div>
              )}
              {(tags.length > 0 || inputValue) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-apple-tertiary-light hover:text-apple-red transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
              {activeSavedQuery &&
                activeSavedQuery.visibility !== "temporary" && (
                  <div className="flex ml-5 items-center gap-1.5 border-l border-apple-border-light px-7">
                    <span
                      className={`w-2 h-2 rounded-full ${isQueryModified ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}
                      title={
                        isQueryModified
                          ? "Consulta modificada (alterações não salvas)"
                          : "Consulta salva e sincronizada"
                      }
                    />
                    <span>
                      Consulta:{" "}
                      <strong className="text-apple-label-light dark:text-apple-label-dark">
                        {activeSavedQuery.name}
                      </strong>
                    </span>
                    {isQueryModified && (
                      <span className="text-amber-500 font-semibold text-[10px]">
                        (modificada)
                      </span>
                    )}
                  </div>
                )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {activeSavedQuery &&
                isQueryModified &&
                activeSavedQuery.visibility !== "temporary" && (
                  <button
                    type="button"
                    onClick={handleUpdateActiveQuery}
                    className="px-2.5 py-1 rounded-md bg-apple-blue/10 text-apple-blue hover:bg-apple-blue/20 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </button>
                )}

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSaveModalOpen(true);
                }}
                disabled={!currentEditingQuery || syntaxErrors.length > 0}
                className="px-2.5 py-1 rounded-md text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-apple-label-dark hover:bg-apple-border-light/50 font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>

              <div className="relative">
                <button
                  ref={savedButtonRef}
                  type="button"
                  onClick={handleToggleSavedDropdown}
                  className="px-2.5 py-1 rounded-md text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-apple-label-dark hover:bg-apple-border-light/50 font-medium flex items-center gap-1 transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Salvas</span>
                  {realSavedQueries.length > 0 && (
                    <span className="bg-apple-blue/20 text-apple-blue text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {realSavedQueries.length}
                    </span>
                  )}
                </button>

                {!isLoading && isSavedDropdownOpen && (
                  <div
                    ref={savedDropdownRef}
                    style={savedDropdownStyle}
                    className="bg-white dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 max-h-72 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-apple-border-light dark:border-apple-border-dark mb-1">
                      <span className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">
                        CONSULTAS SALVAS E PÚBLICAS
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsSavedDropdownOpen(false);
                          if (onManageQueries) onManageQueries();
                          else router.push("/settings/saved-queries");
                        }}
                        className="text-xs text-apple-blue hover:underline font-medium"
                      >
                        gerenciar
                      </button>
                    </div>

                    {realSavedQueries.length === 0 ? (
                      <div className="text-xs text-apple-tertiary-light px-2 py-4 text-center">
                        Nenhuma consulta salva ainda.
                      </div>
                    ) : (
                      realSavedQueries.map((q) => (
                        <div
                          key={q._id}
                          onClick={() => {
                            const params = new URLSearchParams(
                              searchParams.toString(),
                            );
                            params.set("q", q._id);
                            const targetMode = hasComplexSyntax(q.queryString)
                              ? "a"
                              : "t";
                            params.set("m", targetMode);
                            router.replace(
                              `${pathname}?${params.toString()}`,
                              { scroll: false },
                            );
                            setIsSavedDropdownOpen(false);
                          }}
                          className={`group relative text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-apple-border-light/30 transition-colors cursor-pointer ${
                            activeSavedQuery?._id === q._id
                              ? "bg-apple-blue/10 text-apple-blue font-semibold"
                              : "text-apple-label-light dark:text-apple-label-dark"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="font-medium truncate">
                              {q.name}
                            </span>
                            <span className="font-mono text-[10px] text-apple-tertiary-light truncate">
                              {q.queryString}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedQuery(e, q._id)}
                            title="Excluir consulta"
                            className="opacity-0 group-hover:opacity-100 p-1 text-apple-tertiary-light hover:text-apple-red transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleMode}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 border ${
                  mode === "advanced"
                    ? "bg-apple-blue/10 text-apple-blue border-apple-blue/20"
                    : "text-apple-tertiary-light border-transparent hover:border-apple-border-light"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>DBQL</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsAiModalOpen(true);
                }}
                title="Gerar com IA"
                className="p-1.5 rounded-md text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
              >
                <Bot className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsHelpModalOpen(true);
                }}
                className="ml-2 p-2 text-gray-400 hover:text-[#007AFF] transition-colors"
                title="Ajuda DBQL"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              <DBQLHelpModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                context={context}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-10 items-end pr-10 text-apple-tertiary-light text-[12px] relative flex flex-col bg-apple-bg-light dark:bg-apple-bg-dark border dark:border-apple-border-dark rounded-xl px-4 py-3 shadow-sm transition-none outline-none ring-0 focus-within:ring-0 focus:outline-none gap-3">
          DBQL Advanced Search
        </div>
      )}

      {syntaxErrors.length > 0 && isSearchVisible && (
        <div className="flex flex-col gap-2 text-[12px] text-apple-red mt-1 ml-1 font-medium bg-apple-red/5 p-3 rounded-lg border border-apple-red/15">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Erros detectados ({syntaxErrors.length}):</span>
          </div>
          <ol className="list-decimal pl-5 space-y-2">
            {syntaxErrors.map((err, idx) => (
              <li key={idx}>
                <div className="mb-1">{err.error}</div>
                {err.highlightIndex !== null && err.highlightIndex >= 0 && (
                  <div className="font-mono text-[10px] bg-white dark:bg-[#1C1C1E] px-2 py-1 rounded border border-apple-border-light text-apple-label-light dark:text-apple-label-dark inline-block">
                    <span>
                      {currentEditingQuery.substring(
                        Math.max(0, err.highlightIndex - 10),
                        err.highlightIndex,
                      )}
                    </span>
                    <span className="bg-apple-red/25 text-apple-red px-1 py-0.5 rounded font-bold mx-0.5">
                      {currentEditingQuery.substring(
                        err.highlightIndex,
                        err.highlightIndex + err.errorLength,
                      )}
                    </span>
                    <span>
                      {currentEditingQuery.substring(
                        err.highlightIndex + err.errorLength,
                        err.highlightIndex + err.errorLength + 10,
                      )}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Modal Salvar */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={saveModalRef}
            className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4"
          >
            <h3 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark">
              Salvar Consulta DBQL
            </h3>
            <form onSubmit={handleSaveSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-apple-tertiary-light">
                  Nome da consulta
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ex: Observations Críticas de Segurança"
                  className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-apple-tertiary-light">
                  Visibilidade
                </label>
                <select
                  value={saveVisibility}
                  onChange={(e) => setSaveVisibility(e.target.value as Visibility)}
                  className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark"
                >
                  <option value="private">Privada (Apenas você)</option>
                  <option value="shared">Compartilhada (Equipe)</option>
                  <option value="public">Pública</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-apple-tertiary-light hover:bg-apple-border-light/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!saveName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-blue text-white hover:opacity-90 disabled:opacity-40"
                >
                  Salvar Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal IA */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={aiModalRef}
            className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark flex items-center gap-2">
                <Bot className="w-4 h-4 text-apple-blue" />
                <span>Gerar Query com IA (Copiar Prompt)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-apple-tertiary-light hover:text-apple-label-light"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-apple-tertiary-light">
                Descreva abaixo o que deseja buscar. O sistema vai gerar um
                prompt estruturado contendo todas as regras da sintaxe DBQL e o
                contexto atual (<code className="text-apple-blue">{context}</code>) para você colar na sua IA favorita.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">
                  Sua busca em linguagem natural:
                </label>
                <textarea
                  value={aiNaturalInput}
                  onChange={(e) => {
                    setAiNaturalInput(e.target.value);
                    setCopiedPrompt(false);
                  }}
                  rows={3}
                  placeholder="Ex: Quero todas as observations de severidade crítica ou alta do projeto GEPIN que não sejam do arquivo Auth"
                  className="w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl p-3 text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark resize-none font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">
                    Prompt gerado com a documentação DBQL:
                  </label>
                  <span className="text-[10px] text-apple-tertiary-light">
                    Pronto para envio
                  </span>
                </div>
                <div className="relative bg-apple-border-light/10 dark:bg-[#111113] border border-apple-border-light dark:border-apple-border-dark rounded-xl p-3 text-[11px] font-mono text-apple-label-light dark:text-apple-label-dark max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                  {generatedAiPromptText}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-apple-tertiary-light hover:bg-apple-border-light/30"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={!aiNaturalInput.trim()}
                  onClick={() => {
                    navigator.clipboard.writeText(generatedAiPromptText);
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 3000);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-blue text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 transition-all"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Prompt Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Prompt para IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}