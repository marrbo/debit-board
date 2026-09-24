// components/dbql/DBQLAdvancedSearch.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  X,
  Code2,
  HelpCircle,
  BookmarkPlus,
  Bookmark,
  Check,
  Bot,
  Trash2,
  Copy,
  PlayCircleIcon,
  TriangleAlert,
  TagIcon,
  Share2,
  Globe,
  TimerReset,
  HatGlasses,
} from "lucide-react";
import DBQLRichInput from "./DBQLRichInput";
import DBQLHelpModal from "./DBQLHelpModal";
import DBQLSuggestions from "./DBQLSuggestions";
import type { ISavedQuery } from "@/types/ISavedQuery";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";
import {
  getDBQLQueryId,
  setDBQLQueryId,
  clearDBQLQueryId,
} from "@/lib/local-settings";

// ============================================================
// Tipos e interfaces
// ============================================================
interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: string;
  userSub: string;
  onManageQueries?: () => void;
  value?: string;
}

interface ValidationError {
  error: string;
  highlightIndex: number | null;
  errorLength: number;
}

type Visibility = "private" | "shared" | "public";

const MEME_QUIPS = [
  "Houston, temos um problema lógico: 'You shall not pass!' 🧙‍♂️",
  "Matrix corrompida: tentar misturar tantos operadores vai acordar o Neo.",
  "Erro 418: Sou um bule de chá, mas até eu sei que essa sintaxe não faz sentido!",
  "Stack overflow de tokens: operadores encadeados demais para uma única query.",
  "Essa entrada tá com cara de SQL Injection de estagiário. 🕵️‍♂️",
  "Erro 403: O firewall olhou para essa requisição, deu risada e cortou a conexão. 🛡️",
  "Sua validação de dados é tão robusta quanto a senha 'admin123'. 🔑",
  "Nem com criptografia quântica a gente consegue esconder o tamanho dessa gambiarra. 🔐",
  "Acalme-se, jovem Padawan. Essa quantidade de parâmetros já tá virando um ataque DDoS! ⚔️",
  "Parabéns! Você não escreveu um bug, você inventou um exploit zero-day contra o próprio sistema. 💥",
  "O token JWT expirou antes mesmo de eu conseguir entender o que essa requisição faz. ⏳",
  "Parece que alguém tentou fazer bypass no WAF usando fita isolante, chiclete e esperança. 🚧",
  "Erro de CORS: Sua requisição tentou cruzar a fronteira, mas o passaporte não tava carimbado. 🛂",
  "Man-in-the-Middle detectado: e ele ficou confuso com a bagunça que está esse payload. 🥷",
  "Criptografia de ponta a ponta? Só se for da ponta do desespero até a ponta da gambiarra. 🧵",
  "Você tem certeza de que não é um script de ransomware disfarçado de JSON? 🏴‍☠️",
];

// ============================================================
// Helpers puros
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

  const tokenRegex =
    /!?[a-zA-Z0-9_.]+(>=|<=|>|<|!=|:|=)(?:"[^"]*"|[^\s()]+)|\(|\)|[^\s()]+/g;
  const tokens = query.match(tokenRegex) || [];

  let index = 0;
  let looseTextStart: number | null = null;
  let looseTextEnd: number | null = null;
  let looseTextContent = "";

  for (const token of tokens) {
    const tokenIndex = query.indexOf(token, index);
    if (tokenIndex === -1) continue;
    index = tokenIndex + token.length;

    const cleanToken = token.replace(/^\(+/, "").replace(/\)+$/, "");
    const lower = cleanToken.toLowerCase();

    const isOperator = ["and", "or", "not"].includes(lower);
    const isParen = /^[()]+$/.test(token);
    const isField = /^!?[a-zA-Z0-9_.]+(>=|<=|>|<|!=|:|=)/.test(cleanToken);

    if (isOperator || isParen || isField) {
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
    } else {
      if (looseTextStart === null) {
        looseTextStart = tokenIndex;
        looseTextContent = cleanToken;
      } else {
        looseTextContent += ` ${cleanToken}`;
      }
      looseTextEnd = tokenIndex + token.length;
    }
  }

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
          error:
            "Erro de sintaxe: Parêntese fechado sem abertura correspondente.",
          highlightIndex: i,
          errorLength: 1,
        });
    }
  }
  if (stack.length > 0) {
    errors.push({
      error: "Erro de sintaxe: Parêntese aberto não foi fechado.",
      highlightIndex: stack[stack.length - 1] || null,
      errorLength: 1,
    });
  }

  if (/\(\s*\)/.test(query)) {
    const match = query.match(/\(\s*\)/);
    if (match) {
      errors.push({
        error: "Erro de sintaxe: Agrupamento vazio ( ).",
        highlightIndex: match.index ?? 0,
        errorLength: match[0].length,
      });
    }
  }

  let openQuote = false;
  let firstUnclosedQuote = -1;
  for (let i = 0; i < query.length; i++) {
    if (query[i] === '"') {
      openQuote = !openQuote;
      if (openQuote) firstUnclosedQuote = i;
    }
  }
  if (openQuote) {
    errors.push({
      error: "Erro de sintaxe: Aspas duplas não fechadas.",
      highlightIndex: firstUnclosedQuote,
      errorLength: 1,
    });
  }

  const chaoticRegex = /\b(and|or|not)\s+(and|or|not)\s+(and|or|not)\b/i;
  const chaoticMatch = chaoticRegex.exec(query);
  if (chaoticMatch) {
    errors.push({
      error: `${
        MEME_QUIPS[Math.floor(Math.random() * MEME_QUIPS.length)]
      } (Detectado: '${chaoticMatch[0]}')`,
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
  context: dbqlContext = "observations",
  userSub = "",
  onManageQueries,
  value,
}: AdvancedSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const rawUrlQueryId = searchParams.get("q") || "";
  const urlModeParam = searchParams.get("m") || searchParams.get("mode");

  const [mode, setMode] = useState<"tags" | "advanced">("tags");
  const [inputValue, setInputValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [activeQueryString, setActiveQueryString] = useState<string>("");
  const [activeSavedQuery, setActiveSavedQuery] = useState<ISavedQuery | null>(
    null,
  );
  const [originalQueryString, setOriginalQueryString] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<Visibility>("private");
  const [isSavedDropdownOpen, setIsSavedDropdownOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiNaturalInput, setAiNaturalInput] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [savedQueries, setSavedQueries] = useState<ISavedQuery[]>([]);
  const [tempQuery, setTempQuery] = useState<ISavedQuery>();
  const [isLoading, setIsLoading] = useState(true);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const savedButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const savedDropdownRef = useRef<HTMLDivElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const aiModalRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string | undefined>(undefined);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const { data: session } = useSession();

  userSub = userSub ?? session?.user?.sub;

  // ============================================================
  // Derivados (o compilador memoiza automaticamente)
  // ============================================================
  const currentEditingQuery =
    mode === "advanced"
      ? inputValue
      : [...tags, inputValue].filter(Boolean).join(" ");

  const syntaxErrors = validateDBQL(currentEditingQuery);

  const realSavedQueries = savedQueries.filter(
    (q) => q.visibility !== "temporary",
  );

  const isQueryModified =
    !!activeSavedQuery &&
    activeSavedQuery.visibility !== "temporary" &&
    currentEditingQuery !== originalQueryString;

  // ============================================================
  // Handlers
  // ============================================================
  const applyQuery = (query: ISavedQuery, targetMode: "tags" | "advanced") => {
    setActiveSavedQuery(query);
    setOriginalQueryString(query.queryString);
    setActiveQueryString(query.queryString);
    setMode(targetMode);
    if (targetMode === "advanced") {
      setInputValue(query.queryString);
      setTags([]);
    } else {
      setTags(parseInputToTags(query.queryString));
      setInputValue("");
    }
  };

  const handleSelectSavedQuery = (q: ISavedQuery) => {
    const id = q._id.toString();
    const targetMode = hasComplexSyntax(q.queryString) ? "advanced" : "tags";
    applyQuery(q, targetMode);

    const params = new URLSearchParams(searchParams.toString());
    params.set("q", id);
    params.set("m", targetMode === "advanced" ? "a" : "t");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setDBQLQueryId(pathname, id);

    onSearch?.(id);
    setIsSavedDropdownOpen(false);
  };

  const clearAllInternal = () => {
    setTags([]);
    setInputValue("");
    setActiveSavedQuery(null);
    setOriginalQueryString("");
    setActiveQueryString("");
    setMode("tags");
    lastLoadedKeyRef.current = null;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("m");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    clearDBQLQueryId(pathname);

    onSearch?.("");
    setIsSavedDropdownOpen(false);
    setIsOpen(false);
    setTempQuery(undefined);
  };

  const executeSearch = async () => {
    const fullQuery = currentEditingQuery;
    const currentMode = mode;

    if (!fullQuery) {
      clearAllInternal();
      return;
    }

    try {
      const id = activeSavedQuery?._id || tempQuery?._id || null;
      const visibility = activeSavedQuery?.visibility || "temporary";
      const name =
        activeSavedQuery?.name ||
        `Temporária (${session?.user?.name} - ${dbqlContext})`;

      if (fullQuery === activeQueryString && currentMode === mode) {
        onSearch?.(id ? id.toString() : "");
        return;
      }

      if (!id || visibility === "temporary") {
        const payload = {
          id,
          name,
          queryString: fullQuery,
          context: dbqlContext,
          visibility: "temporary",
          userSub: session?.user?.sub,
        };
        const method = id ? "PUT" : "POST";
        const body = id ? { ...payload, id } : payload;

        const res = await fetch("/api/saved-query", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const saved = (await res.json()) as ISavedQuery;
          const newId = saved._id.toString();
          setActiveSavedQuery(saved);
          setOriginalQueryString(saved.queryString);
          setActiveQueryString(fullQuery);

          const params = new URLSearchParams(searchParams.toString());
          params.set("q", newId);
          params.set("m", currentMode === "advanced" ? "a" : "t");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          setDBQLQueryId(pathname, newId);

          onSearch?.(newId);
        }
      } else if (fullQuery !== originalQueryString) {
        const res = await fetch("/api/saved-query", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name: activeSavedQuery?.name,
            queryString: fullQuery,
            context: dbqlContext,
            userSub: session?.user?.sub?.toString() || session?.user?.sub,
          }),
        });
        if (res.ok) {
          const updated = (await res.json()) as ISavedQuery;
          const updatedId = updated._id.toString();
          setActiveSavedQuery(updated);
          setOriginalQueryString(updated.queryString);
          setActiveQueryString(fullQuery);

          const params = new URLSearchParams(searchParams.toString());
          params.set("m", currentMode === "advanced" ? "a" : "t");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          setDBQLQueryId(pathname, updatedId);
          if (updated.visibility === "temporary") setTempQuery(updated);

          onSearch?.(updatedId);
        }
      } else {
        const params = new URLSearchParams(searchParams.toString());
        const expectedMode = currentMode === "advanced" ? "a" : "t";
        if (params.get("m") !== expectedMode) {
          params.set("m", expectedMode);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        setActiveQueryString(fullQuery);
        onSearch?.(activeSavedQuery?._id?.toString() || "");
      }
    } catch (err) {
      console.error("Erro ao persistir query:", err);
    }
  };

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
        setTags([...tags, inputValue.trim()]);
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

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleMode = (e: React.MouseEvent) => {
    if (mode === "tags") {
      const fullQuery = tags.join(" ") + (inputValue ? ` ${inputValue}` : "");
      setInputValue(fullQuery.trim());
      setMode("advanced");
    } else {
      if (hasComplexSyntax(inputValue)) {
        alert("A consulta possui sintaxes avançadas exclusivas.");
        return;
      }
      setTags(parseInputToTags(inputValue));
      setInputValue("");
      setMode("tags");
    }
    e.preventDefault();
  };

  const clearAll = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    clearAllInternal();
  };

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

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || !currentEditingQuery) return;

    try {
      const res = await fetch("/api/saved-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          queryString: currentEditingQuery,
          context: dbqlContext,
          visibility: saveVisibility,
          userSub,
        }),
      });
      if (res.ok) {
        const saved = (await res.json()) as ISavedQuery;
        const newId = saved._id.toString();
        setActiveSavedQuery(saved);
        setOriginalQueryString(saved.queryString);
        setActiveQueryString(saved.queryString);
        setIsSaveModalOpen(false);
        setSaveName("");

        const params = new URLSearchParams(searchParams.toString());
        params.set("q", newId);
        params.set("m", mode === "advanced" ? "a" : "t");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        setDBQLQueryId(pathname, newId);

        const listRes = await fetch(`/api/saved-query?context=${dbqlContext}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json();
          setSavedQueries(Array.isArray(data) ? data : data.data || []);
        }
        onSearch?.(newId);
      }
    } catch (err) {
      console.error("Erro ao salvar nova query", err);
    }
  };

  const handleUpdateActiveQuery = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeSavedQuery || activeSavedQuery.visibility === "temporary")
      return;
    try {
      const res = await fetch("/api/saved-query", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSavedQuery._id,
          name: activeSavedQuery.name,
          queryString: currentEditingQuery,
          context: dbqlContext,
          userSub,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ISavedQuery;
        setActiveSavedQuery(updated);
        setOriginalQueryString(updated.queryString);
        setActiveQueryString(updated.queryString);

        const listRes = await fetch(`/api/saved-query?context=${dbqlContext}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json();
          setSavedQueries(Array.isArray(data) ? data : data.data || []);
        }
        onSearch?.(updated._id.toString());
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
      const res = await fetch(`/api/saved-query?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeSavedQuery?._id.equals(id)) clearAllInternal();
        const listRes = await fetch(`/api/saved-query?context=${dbqlContext}`, {
          cache: "no-store",
        });
        if (listRes.ok) {
          const data = await listRes.json();
          setSavedQueries(Array.isArray(data) ? data : data.data || []);
        }
      }
    } catch (err) {
      console.error("Erro ao excluir query salva", err);
    }
  };

  const handleToggleSavedDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSavedDropdownOpen && savedButtonRef.current) {
      const rect = savedButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsSavedDropdownOpen((prev) => !prev);
  };

  // ============================================================
  // Effects
  // ============================================================
  // Sincronização com valor externo
  useEffect(() => {
    if (value === undefined || value === lastValueRef.current) return;
    lastValueRef.current = value;

    Promise.resolve().then(() => {
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
    });
  }, [value]);

  // Dropdown: resize
  useEffect(() => {
    if (!isSavedDropdownOpen || !savedButtonRef.current) return;
    const handleResize = () => {
      const rect = savedButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newPos = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
      setDropdownPosition((prev) =>
        prev && prev.top === newPos.top && prev.right === newPos.right
          ? prev
          : newPos,
      );
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSavedDropdownOpen]);

  // Dropdown: click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        savedDropdownRef.current &&
        !savedDropdownRef.current.contains(e.target as Node) &&
        savedButtonRef.current &&
        !savedButtonRef.current.contains(e.target as Node)
      ) {
        setIsSavedDropdownOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  // Carregamento: URL > local-settings > vazio
  useEffect(() => {
    const loadFromUrl = async () => {
      const storedId = getDBQLQueryId(pathname);
      const targetId = rawUrlQueryId || storedId || "";

      if (!rawUrlQueryId && storedId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("q", storedId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }

      const loadKey = `${pathname}::${targetId}`;
      if (lastLoadedKeyRef.current === loadKey) return;
      lastLoadedKeyRef.current = loadKey;

      setIsLoading(true);

      try {
        if (targetId) {
          const res = await fetch(`/api/saved-query?id=${targetId}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const json = await res.json();
            const matched = Array.isArray(json)
              ? json[0]
              : Array.isArray(json?.data)
                ? json.data[0]
                : json;

            if (matched?.queryString) {
              const query = matched as ISavedQuery;
              const targetMode = hasComplexSyntax(query.queryString)
                ? "advanced"
                : "tags";
              applyQuery(query, targetMode);
              setDBQLQueryId(pathname, targetId);
              onSearch?.(targetId);
              return;
            }
          }
        }

        lastLoadedKeyRef.current = null;
        setActiveSavedQuery(null);
        setOriginalQueryString("");
        setActiveQueryString("");
        const initialMode =
          urlModeParam === "a" || urlModeParam === "advanced"
            ? "advanced"
            : "tags";
        setMode(initialMode);
        setInputValue("");
        setTags([]);
        onSearch?.("");

        const params = new URLSearchParams(searchParams.toString());
        if (params.has("q") || params.has("m")) {
          params.delete("q");
          params.delete("m");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
      } catch (err) {
        console.error("Erro ao carregar query da URL:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlQueryId, urlModeParam, pathname, router, searchParams, onSearch]);

  // Lista de queries salvas
  useEffect(() => {
    const fetchSavedQueries = async () => {
      try {
        const res = await fetch(`/api/saved-query?context=${dbqlContext}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const queries = Array.isArray(json) ? json : json.data || [];
        setSavedQueries(queries as ISavedQuery[]);

        const existingTemp = queries.find(
          (q: ISavedQuery) =>
            q.visibility === "temporary" && q.sub?.toString() === userSub,
        );
        if (existingTemp) {
          setTempQuery(existingTemp);
        } else {
          setTempQuery({
            userSub,
            name: `Temporary (${session?.user?.name})`,
            context: dbqlContext,
            tenantId: session?.user?.tenantId,
            visibility: "temporary",
            queryString: "",
          } as unknown as ISavedQuery);
        }
      } catch (err) {
        console.error("Erro ao buscar saved queries", err);
        setSavedQueries([]);
      }
    };
    fetchSavedQueries();
  }, [dbqlContext, session?.user?.name, session?.user?.tenantId, userSub]);

  // Sugestões
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
          `/api/observation-filters?field=${encodeURIComponent(
            tokenData.fieldKey || "",
          )}&query=${encodeURIComponent(
            tokenData.query || "",
          )}&context=${encodeURIComponent(dbqlContext)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const list = Array.from(
            new Set(data.suggestions || data.values || []),
          ).filter((item): item is string => typeof item === "string");
          const filtered = list
            .filter(
              (item) => item.toLowerCase() !== tokenData.query?.toLowerCase(),
            )
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
  }, [inputValue, dbqlContext]);

  // Aviso de saída sem salvar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isQueryModified) {
        e.preventDefault();
        return "Você tem alterações não salvas. Deseja realmente sair?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isQueryModified]);

  // ============================================================
  // Prompt IA (derivado)
  // ============================================================
  const generatedAiPromptText = `Você é um assistente especialista na Debit Board Query Language (DBQL).
Contexto atual da interface: ${dbqlContext} (AdvancedQuery - DBQL).

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

  const VISIBILITY_ICONS: Record<string, React.ReactNode> = {
    temporary: <TimerReset size={12} className="text-muted" />,
    private: <HatGlasses size={12} className="text-muted" />,
    public: <Globe size={12} className="text-muted" />,
    shared: <Share2 size={12} className="text-muted" />,
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="relative w-full flex flex-col gap-1.5">
      <div
        className={`relative flex flex-col bg-elevated border rounded-lg px-4 py-3 shadow-sm hover:drop-shadow-lg transition-none outline-none ring-0 focus-within:ring-0 focus:outline-none gap-3 ${
          syntaxErrors.length > 0
            ? "border-apple-red"
            : "border-default dark:border-strong"
        }`}
      >
        <div className="flex items-start gap-2 w-full">
          <TriangleAlert
            className={`w-4 h-4 shrink-0 ${
              syntaxErrors.length > 0 ? "block text-error" : "hidden"
            }`}
          />

          <div className="flex flex-col flex-1 gap-1.5 min-w-0">
            {mode === "tags" && tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-[13px] bg-white dark:bg-[#2C2C2E] text-heading dark:text-heading px-2 py-1 rounded-md border border-default dark:border-strong shadow-sm hover:drop-shadow-lg font-mono font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      className="text-muted hover:text-error transition-colors"
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

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-default dark:border-strong text-xs">
          <div className="text-[11px] text-muted flex items-center gap-2">
            {(tags.length > 0 || inputValue) && (
              <div className="flex items-center gap-1.5 mr-5">
                <button
                  type="button"
                  onClick={handleExecuteSearch}
                  disabled={syntaxErrors.length > 0}
                  className="hover:!bg-green-500 hover:text-white text-green-500 transition-colors flex items-center gap-1 ml-1 disabled:opacity-40 disabled:hover:text-muted"
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
                className="hover:!bg-red-500 hover:!text-white text-error-500 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
            {activeSavedQuery &&
              activeSavedQuery.visibility !== "temporary" && (
                <div className="flex ml-5 items-center gap-1.5 border-l border-default px-7">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isQueryModified
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500"
                    }`}
                    title={
                      isQueryModified
                        ? "Consulta modificada (alterações não salvas)"
                        : "Consulta salva e sincronizada"
                    }
                  />
                  <span>
                    Consulta:{" "}
                    <strong className="text-heading dark:text-heading">
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
                  className="px-2.5 py-1 rounded-md bg-brand/10 text-success hover:bg-brand/20 font-medium flex items-center gap-1 transition-colors"
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
              className="px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors disabled:opacity-40"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </button>

            <div className="relative">
              <button
                ref={savedButtonRef}
                type="button"
                onClick={handleToggleSavedDropdown}
                className="px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Salvas</span>
                {realSavedQueries.length > 0 && (
                  <span className="text-[12px] text-warning-500 px-1.5 py-0.2 rounded-full font-bold">
                    {realSavedQueries.length}
                  </span>
                )}
              </button>

              {!isLoading &&
                isSavedDropdownOpen &&
                dropdownPosition &&
                createPortal(
                  <div
                    ref={savedDropdownRef}
                    className="fixed z-[9999] w-80 shadow-sm drop-shadow-sm bg-sunken border border-default dark:border-strong rounded-lg shadow-xl"
                    style={{
                      top: dropdownPosition.top,
                      right: dropdownPosition.right,
                    }}
                  >
                    <div className="flex items-center justify-between px-2 py-3 border-b">
                      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        CONSULTAS SALVAS
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsSavedDropdownOpen(false);
                          if (onManageQueries) onManageQueries();
                          else router.push("/settings/saved-queries");
                        }}
                        className="text-xs text-brand dark:text-brand-300 hover:underline font-medium"
                      >
                        gerenciar
                      </button>
                    </div>

                    {realSavedQueries.length === 0 ? (
                      <div className="text-xs text-muted px-2 py-4 text-center">
                        Nenhuma consulta salva ainda.
                      </div>
                    ) : (
                      realSavedQueries.map((q) => (
                        <div
                          key={q._id.toString()}
                          onClick={() => handleSelectSavedQuery(q)}
                          className={`group relative text-left px-2.5 py-2 bg-elevated border-b dark:border-b-sunken last:rounded-b-xl last:border-none text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            activeSavedQuery?._id === q._id
                              ? "bg-sunken dark:text-brand-300 text-brand font-bold border-l-4 dark:border-l-brand-300 border-l-brand"
                              : "text-muted"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex gap-2">
                              <span className="shrink-0 flex items-center justify-center">
                                {VISIBILITY_ICONS[q.visibility]}
                              </span>
                              <h3
                                className="font-semibold group-hover:underline text-body dark:text-body truncate flex-1 min-w-0"
                                title={q.name}
                              >
                                {q.name}
                              </h3>
                            </div>
                            <span className="font-mono text-[10px] font-extralight text-muted truncate">
                              {q.queryString}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleDeleteSavedQuery(e, q._id.toString())
                            }
                            title="Excluir consulta"
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-error transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>,
                  document.body,
                )}
            </div>

            <button
              type="button"
              onClick={toggleMode}
              className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 border ${
                mode === "advanced"
                  ? "bg-brand/10 text-brand dark:text-brand-300 border-brand/20"
                  : "text-muted border-transparent hover:border-default"
              }`}
            >
              {mode === "advanced" ? (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Advanced</span>
                </>
              ) : (
                <>
                  <TagIcon className="w-3.5 h-3.5" />
                  <span>Tags</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsAiModalOpen(true);
              }}
              title="Gerar com IA"
              className="p-2 rounded-md transition-colors"
            >
              <Bot className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsHelpModalOpen(true);
              }}
              className="ml-2 p-2 rounded-md transition-colors"
              title="Ajuda DBQL"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <DBQLHelpModal
              isOpen={isHelpModalOpen}
              onClose={() => setIsHelpModalOpen(false)}
              context={dbqlContext}
            />
          </div>
        </div>
      </div>

      {syntaxErrors.length > 0 && (
        <div className="flex flex-col gap-2 text-[12px] text-error mt-1 ml-1 font-medium bg-apple-red/5 p-3 rounded-lg border border-apple-red/15">
          <div className="flex items-center gap-1.5 font-bold text-[14px]">
            <TriangleAlert className="w-5 h-5 shrink-0 animate-pulse text-yellow-500" />
            <span>Erros detectados ({syntaxErrors.length}):</span>
          </div>
          <ol className="list-decimal pl-5 space-y-2">
            {syntaxErrors.map((err, idx) => (
              <li key={idx}>
                <div className="mb-1">{err.error}</div>
                {err.highlightIndex !== null && err.highlightIndex >= 0 && (
                  <div className="font-mono text-[10px] bg-white dark:bg-[#1C1C1E] px-2 py-1 rounded border border-default text-heading dark:text-heading inline-block">
                    <span>
                      {currentEditingQuery.substring(
                        Math.max(0, err.highlightIndex - 10),
                        err.highlightIndex,
                      )}
                    </span>
                    <span className="bg-apple-red/25 text-error px-1 py-0.5 rounded font-bold mx-0.5">
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

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={saveModalRef}
            className="bg-white dark:bg-[#1C1C1E] border border-default dark:border-strong rounded-lg p-6 w-full max-w-md shadow-2xl flex flex-col gap-4"
          >
            <h3 className="text-base font-bold text-heading dark:text-heading">
              Salvar Consulta DBQL
            </h3>
            <form onSubmit={handleSaveSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">
                  Nome da consulta
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ex: Observations Críticas de Segurança"
                  className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-default dark:border-strong rounded-lg text-xs outline-none focus:border-brand text-heading dark:text-heading"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">
                  Visibilidade
                </label>
                <select
                  value={saveVisibility}
                  onChange={(e) =>
                    setSaveVisibility(e.target.value as Visibility)
                  }
                  className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-default dark:border-strong rounded-lg text-xs outline-none focus:border-brand text-heading dark:text-heading"
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
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:bg-apple-border-light/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!saveName.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-brand hover:opacity-90 disabled:opacity-40"
                >
                  Salvar Consulta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={aiModalRef}
            className="bg-white dark:bg-[#1C1C1E] border border-default dark:border-strong rounded-lg p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-heading dark:text-heading flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand dark:text-brand-300" />
                <span>Gerar Query com IA (Copiar Prompt)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-muted hover:text-heading"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted">
                Descreva abaixo o que deseja buscar. O sistema vai gerar um
                prompt estruturado contendo todas as regras da sintaxe DBQL e o
                contexto atual (
                <code className="text-brand">{dbqlContext}</code>) para você
                colar na sua IA favorita.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
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
                  className="w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-default dark:border-strong rounded-lg p-3 text-xs outline-none focus:border-brand text-heading dark:text-heading resize-none font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Prompt gerado com a documentação DBQL:
                  </label>
                  <span className="text-[10px] text-muted">
                    Pronto para envio
                  </span>
                </div>
                <div className="relative bg-apple-border-light/10 dark:bg-[#111113] border border-default dark:border-strong rounded-lg p-3 text-[11px] font-mono text-heading dark:text-heading max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                  {generatedAiPromptText}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted"
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
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5 transition-all"
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
