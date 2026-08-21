// components/AdvancedSearch.tsx
'use client';

import { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, X, Code2, HelpCircle, AlertCircle, BookmarkPlus, Bookmark, Check, Save, Share2, Globe, Bot } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: 'issues' | 'stats' | 'projects' | 'repositories';
}

const STORAGE_KEY_MODE = 'debitboard_search_mode';

const HELP_PROPERTIES = {
  issues: [
    { prop: 'category', desc: 'Categoria da vulnerabilidade', ex: 'category:"Broken Access Control"' },
    { prop: 'severity', desc: 'Severidade (critical, high, medium, low)', ex: 'severity:critical' },
    { prop: 'branch', desc: 'Branch do repositório', ex: 'branch:main' },
    { prop: 'project', desc: 'Nome do projeto', ex: 'project:GEPIN_AS' },
    { prop: 'fileName', desc: 'Nome ou caminho do arquivo', ex: 'fileName:*Controller.cs' },
    { prop: 'repository', desc: 'Repositório', ex: 'repository:repo-name' },
    { prop: 'status', desc: 'Status da issue (open, fixed, etc.)', ex: 'status:open' },
    { prop: 'is', desc: 'Estado especial', ex: 'is:unresolved' },
  ],
  stats: [
    { prop: 'project', desc: 'Filtrar métricas por projeto', ex: 'project:GEPIN_AS' },
    { prop: 'severity', desc: 'Filtrar por severidade', ex: 'severity:high' },
  ],
  projects: [
    { prop: 'name', desc: 'Nome do projeto', ex: 'name:Portal' },
    { prop: 'teamIds', desc: 'IDs dos times vinculados', ex: 'teamIds:dev' },
  ],
  repositories: [
    { prop: 'name', desc: 'Nome do repositório', ex: 'name:backend-api' },
    { prop: 'branch', desc: 'Branch principal', ex: 'branch:main' },
  ]
};

const MEME_QUIPS = [
  "Houston, temos um problema lógico: 'You shall not pass!' 🧙‍♂️",
  "Inception booleana detectada: operador dentro de operador. É realmente isso que quer fazer?",
  "Matrix corrompida: tentar misturar tantos operadores vai acordar o Neo.",
  "Erro 418: Sou um bule de chá, mas até eu sei que essa sintaxe não faz sentido!"
];

export default function AdvancedSearch({
  onSearch,
  placeholder = 'Buscar... ex: category:"Broken Access Control" and severity:high',
  context = 'issues'
}: AdvancedSearchProps) {
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  
  const rawUrlQueryId = searchParams.get('q') || '';
  const urlModeParam = searchParams.get('m') || searchParams.get('mode');

  const [mode, setMode] = useState<'tags' | 'advanced'>('tags');
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveVisibility, setSaveVisibility] = useState<'private' | 'shared' | 'public'>('private');
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [isSavedDropdownOpen, setIsSavedDropdownOpen] = useState(false);
  const [overwriteConfirmQuery, setOverwriteConfirmQuery] = useState<any | null>(null);
  const [activeSavedQuery, setActiveSavedQuery] = useState<{ id: string; name: string; queryString: string } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tempQueryIdRef = useRef<string | null>(null);

  // Auto-resize do textarea garantindo altura mínima
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 48)}px`;
    }
  }, [inputValue, tags]);

  const validateDBQL = (query: string): { error: string | null; highlightIndex: number | null; errorLength: number } => {
    if (!query) return { error: null, highlightIndex: null, errorLength: 0 };

    const stack: number[] = [];
    for (let i = 0; i < query.length; i++) {
      if (query[i] === '(') {
        stack.push(i);
      } else if (query[i] === ')') {
        if (stack.length > 0) {
          stack.pop();
        } else {
          return { error: 'Erro de sintaxe: Parêntese fechado sem abertura correspondente.', highlightIndex: i, errorLength: 1 };
        }
      }
    }
    if (stack.length > 0) {
      return { error: 'Erro de sintaxe: Parêntese aberto não foi fechado.', highlightIndex: stack[stack.length - 1], errorLength: 1 };
    }

    if (/\(\s*\)[\)]*/.test(query)) {
      const match = query.match(/\(\s*\)/);
      return { error: 'Erro de sintaxe: Agrupamento vazio ( ).', highlightIndex: match?.index ?? 0, errorLength: match ? match[0].length : 2 };
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
      return { error: 'Erro de sintaxe: Aspas duplas não fechadas.', highlightIndex: firstUnclosedQuote, errorLength: 1 };
    }

    const typoOperatorRegex = /\b(nd|od|nt|annd|orr|anp)\b/i;
    const typoMatch = typoOperatorRegex.exec(query);
    if (typoMatch) {
      return { 
        error: `Erro de sintaxe: Possível erro de digitação no operador lógico ('${typoMatch[0]}'). Quis dizer and ou or?`, 
        highlightIndex: typoMatch.index ?? 0,
        errorLength: typoMatch[0].length
      };
    }

    const chaoticRegex = /\b(and|or|not)\s+(and|or|not)\s+(and|or|not)\b/i;
    const chaoticMatch = chaoticRegex.exec(query);
    if (chaoticMatch) {
      const randomMeme = MEME_QUIPS[Math.floor(Math.random() * MEME_QUIPS.length)];
      return { error: `${randomMeme} (Detectado: '${chaoticMatch[0]}')`, highlightIndex: chaoticMatch.index ?? 0, errorLength: chaoticMatch[0].length };
    }

    const consecutiveRegex = /\b(and|or)\s+(and|or)\b/i;
    const consecutiveMatch = consecutiveRegex.exec(query);
    if (consecutiveMatch) {
      return { error: 'Erro de sintaxe: Operadores lógicos consecutivos inválidos.', highlightIndex: consecutiveMatch.index ?? 0, errorLength: consecutiveMatch[0].length };
    }

    const startMatch = query.match(/^\s*(and|or)\b/i);
    if (startMatch) {
      return { error: 'Erro de sintaxe: Operador lógico isolado no início da expressão.', highlightIndex: startMatch.index ?? 0, errorLength: startMatch[0].trim().length };
    }

    const endMatch = query.match(/\b(and|or|not)\s*$/i);
    if (endMatch) {
      return { error: 'Erro de sintaxe: Operador lógico isolado no término da expressão.', highlightIndex: endMatch.index ?? (query.length - endMatch[0].trim().length), errorLength: endMatch[0].trim().length };
    }

    const emptyFieldRegex = /\b[a-zA-Z0-9_]+:\s*(?=$|\b(?:and|or|not)\b)/i;
    const emptyFieldMatch = emptyFieldRegex.exec(query);
    if (emptyFieldMatch) {
      return { error: 'Erro de sintaxe: Campo de busca incompleto (valor ausente após os dois-pontos).', highlightIndex: emptyFieldMatch.index ?? 0, errorLength: emptyFieldMatch[0].length };
    }

    return { error: null, highlightIndex: null, errorLength: 0 };
  };

  const hasComplexSyntax = (q: string): boolean => {
    return /[\(\)!\*]/.test(q);
  };

  const parseInputToTags = (input: string): string[] => {
    const regex = /(?:(?:and|or)\s+not\s+|(?:and|or|not)\s+)?!?[a-zA-Z0-9_]+:(?:"[^"]*"|\S+)/gi;
    const matches = input.match(regex) || [];
    return matches.map(m => m.trim());
  };

  const getEditingToken = (text: string) => {
    const tokens = text.split(/(?=\b(?:and|or|not)\b|\s)/i).map(t => t.trim()).filter(Boolean);
    const currentToken = tokens[tokens.length - 1] || '';
    const cleanToken = currentToken.replace(/^[\(!]+|\b(?:and\s+not|or\s+not|not|and|or)\s+/gi, '');
    if (!cleanToken.includes(':')) return null;
    const colonIndex = cleanToken.indexOf(':');
    const fieldKey = cleanToken.substring(0, colonIndex).trim();
    const rawQuery = cleanToken.substring(colonIndex + 1).trim();
    const query = rawQuery.replace(/^"/, '');
    return { rawToken: currentToken, cleanToken, fieldKey, query };
  };

  const fetchSavedQueries = async () => {
    try {
      const res = await fetch(`/api/saved-queries?context=${context}`);
      if (res.ok) {
        const data = await res.json();
        setSavedQueries(data);
        
        if (rawUrlQueryId) {
          const matched = data.find((q: any) => q._id === rawUrlQueryId || q.slug === rawUrlQueryId);
          if (matched) {
            setActiveSavedQuery({ id: matched._id, name: matched.name, queryString: matched.queryString });
            if (hasComplexSyntax(matched.queryString) || urlModeParam === 'a' || urlModeParam === 'advanced') {
              setMode('advanced');
              setInputValue(matched.queryString);
            } else {
              setMode('tags');
              setTags(parseInputToTags(matched.queryString));
            }
            if (onSearch) onSearch(matched.queryString);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar saved queries', err);
    }
  };

  useEffect(() => {
    fetchSavedQueries();
    const resolvedMode = urlModeParam === 'a' || urlModeParam === 'advanced' ? 'advanced' : (urlModeParam === 't' || urlModeParam === 'tags' ? 'tags' : (sessionStorage.getItem(STORAGE_KEY_MODE) === 'advanced' ? 'advanced' : 'tags'));
    setMode(resolvedMode);
  }, [context]);

  const currentQueryString = mode === 'advanced' ? inputValue : [...tags, inputValue].filter(Boolean).join(' ');
  const isQueryModified = activeSavedQuery ? currentQueryString !== activeSavedQuery.queryString : false;

  const validationResult = useMemo(() => validateDBQL(currentQueryString), [currentQueryString]);
  const syntaxError = validationResult.error;
  const syntaxErrorIndex = validationResult.highlightIndex;
  const syntaxErrorLength = validationResult.errorLength || 1;

  useEffect(() => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData || !tokenData.fieldKey || tokenData.query.includes('*')) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveField(null);
      return;
    }

    setActiveField(tokenData.fieldKey);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/observation-filters?field=${encodeURIComponent(tokenData.fieldKey)}&query=${encodeURIComponent(tokenData.query)}&context=${encodeURIComponent(context)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const list = data.suggestions || data.values || [];
          setSuggestions(list);
          setIsOpen(list.length > 0);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [inputValue, context]);

  const updateAndSearch = async (fullQuery: string, currentMode: 'tags' | 'advanced') => {
    if (syntaxError) return;
    const modeParamVal = currentMode === 'advanced' ? 'a' : 't';
    sessionStorage.setItem(STORAGE_KEY_MODE, currentMode);
    
    let queryRefId = rawUrlQueryId;

    if (fullQuery) {
      try {
        if (tempQueryIdRef.current) {
          await fetch('/api/saved-queries', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: tempQueryIdRef.current,
              name: `Temporária (${context})`,
              queryString: fullQuery,
              context,
              visibility: 'private'
            })
          });
          queryRefId = tempQueryIdRef.current;
        } else {
          const res = await fetch('/api/saved-queries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              name: `Temporária (${context})`, 
              queryString: fullQuery, 
              context, 
              isTemporary: true,
              visibility: 'private'
            })
          });
          if (res.ok) {
            const created = await res.json();
            tempQueryIdRef.current = created._id;
            queryRefId = created._id;
          }
        }
      } catch (e) {
        console.error('Erro ao registrar query temporária', e);
      }
    } else {
      queryRefId = '';
    }

    const params = new URLSearchParams(window.location.search);
    if (queryRefId) {
      params.set('q', queryRefId);
    } else {
      params.delete('q');
    }
    params.set('m', modeParamVal);
    params.delete('mode');
    
    window.history.replaceState(null, '', `?${params.toString()}`);

    startTransition(() => {
      if (onSearch) onSearch(fullQuery);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (syntaxError) return;

      if (mode === 'advanced') {
        updateAndSearch(inputValue, mode);
      } else {
        if (inputValue.trim()) {
          const newTags = [...tags, inputValue.trim()];
          setTags(newTags);
          setInputValue('');
          updateAndSearch(newTags.join(' '), mode);
        } else {
          updateAndSearch(tags.join(' '), mode);
        }
      }
      setIsOpen(false);
    } else if (e.key === 'Backspace' && mode === 'tags' && !inputValue && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      updateAndSearch(newTags.join(' '), mode);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData || !tokenData.fieldKey) return;
    const formattedVal = suggestion.includes(' ') && !suggestion.startsWith('"') ? `"${suggestion}"` : suggestion;
    const prefixMatch = tokenData.rawToken.match(/^([\(!]+|\b(?:and\s+not|or\s+not|not|and|or)\s+)/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    const newToken = `${prefix}${tokenData.fieldKey}:${formattedVal}`;

    if (mode === 'advanced') {
      const tokens = inputValue.split(/(?=\b(?:and|or|not)\b|\s)/i).map(t => t.trim()).filter(Boolean);
      tokens[tokens.length - 1] = newToken;
      const newQuery = tokens.join(' ');
      setInputValue(newQuery);
      if (!validateDBQL(newQuery).error) updateAndSearch(newQuery, mode);
    } else {
      const newTags = [...tags, newToken];
      setTags(newTags);
      if (!validateDBQL(newTags.join(' ')).error) updateAndSearch(newTags.join(' '), mode);
      setInputValue('');
    }
    setSuggestions([]);
    setIsOpen(false);
    setActiveField(null);
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, idx) => idx !== indexToRemove);
    setTags(newTags);
    updateAndSearch(newTags.join(' '), mode);
  };

  const toggleMode = () => {
    if (mode === 'tags') {
      const fullQuery = tags.join(' ') + (inputValue ? ` ${inputValue}` : '');
      setInputValue(fullQuery.trim());
      setMode('advanced');
      if (!validateDBQL(fullQuery.trim()).error) updateAndSearch(fullQuery.trim(), 'advanced');
    } else {
      if (hasComplexSyntax(inputValue)) {
        alert("A consulta possui sintaxes avançadas exclusivas.");
        return;
      }
      const parsed = parseInputToTags(inputValue);
      setTags(parsed);
      setInputValue('');
      setMode('tags');
      updateAndSearch(parsed.join(' '), 'tags');
    }
  };

  const performSave = async (nameToSave: string) => {
    const existing = savedQueries.find(sq => sq.name.toLowerCase() === nameToSave.toLowerCase() && !sq.isTemporary);
    try {
      let res;
      if (existing) {
        res = await fetch('/api/saved-queries', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing._id, name: nameToSave, queryString: currentQueryString, context, visibility: saveVisibility })
        });
        if (res.ok) {
          const updated = await res.json();
          setActiveSavedQuery({ id: updated._id, name: updated.name, queryString: updated.queryString });
        }
      } else {
        res = await fetch('/api/saved-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameToSave, queryString: currentQueryString, context, isTemporary: false, visibility: saveVisibility })
        });
        if (res.ok) {
          const created = await res.json();
          setActiveSavedQuery({ id: created._id, name: created.name, queryString: created.queryString });
        }
      }

      if (res && res.ok) {
        setSaveName('');
        setIsSaveModalOpen(false);
        setOverwriteConfirmQuery(null);
        await fetchSavedQueries();
      } else {
        alert('Erro ao salvar consulta.');
      }
    } catch (err) {
      alert('Erro de rede ao salvar.');
    }
  };

  const handleSaveQuerySubmit = async (e: React.FormEvent, forceNewName = false) => {
    e.preventDefault();
    if (!saveName || !currentQueryString || syntaxError) return;

    const existing = savedQueries.find(sq => sq.name.toLowerCase() === saveName.toLowerCase() && !sq.isTemporary);
    if (existing && !forceNewName) {
      setOverwriteConfirmQuery(existing);
      return;
    }

    await performSave(saveName);
  };

  const handleQuickUpdate = async () => {
    if (!activeSavedQuery || syntaxError) return;
    try {
      const res = await fetch('/api/saved-queries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSavedQuery.id,
          name: activeSavedQuery.name,
          queryString: currentQueryString,
          context
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveSavedQuery({ id: updated._id, name: updated.name, queryString: updated.queryString });
        await fetchSavedQueries();
      }
    } catch (err) {
      alert('Erro de rede.');
    }
  };

  const loadSavedQuery = (sq: any) => {
    setActiveSavedQuery({ id: sq._id, name: sq.name, queryString: sq.queryString });
    if (hasComplexSyntax(sq.queryString)) {
      setMode('advanced');
      setInputValue(sq.queryString);
    } else {
      setMode('tags');
      setTags(parseInputToTags(sq.queryString));
      setInputValue('');
    }
    updateAndSearch(sq.queryString, mode);
    setIsSavedDropdownOpen(false);
  };

  const deleteSavedQuery = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-queries?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeSavedQuery?.id === id) setActiveSavedQuery(null);
        await fetchSavedQueries();
      }
    } catch (err) {
      alert('Erro ao remover query salva.');
    }
  };

  const clearAll = () => {
    setTags([]);
    setInputValue('');
    setSuggestions([]);
    setActiveSavedQuery(null);
    tempQueryIdRef.current = null;
    updateAndSearch('', mode);
  };

  const renderDBQLColoredQuery = (text: string) => {
    if (!text) return null;
    const regex = /("[^"]*"|!?\b[a-zA-Z0-9_]+:"[^"]*"|!?\b[a-zA-Z0-9_]+:[^\s]+|\b(?:and|or|not)\b|[\(\)]|\s+|[^\s]+)/gi;
    const parts = text.match(regex) || [text];

    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (['and', 'or', 'not'].includes(lower)) {
        return <span key={i} className="text-purple-600 dark:text-purple-400 font-bold">{part}</span>;
      }
      if (part === '(' || part === ')') {
        return <span key={i} className="text-pink-600 dark:text-pink-400 font-bold">{part}</span>;
      }
      const matchField = part.match(/^(!?)([a-zA-Z0-9_]+):(.*)$/);
      if (matchField) {
        const [, excl, field, val] = matchField;
        return (
          <span key={i}>
            {excl && <span className="text-pink-600 dark:text-pink-400 font-bold">{excl}</span>}
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{field}:</span>
            <span className="text-amber-600 dark:text-amber-400">{val}</span>
          </span>
        );
      }
      if (/^["'].*?["']$/.test(part)) {
        return <span key={i} className="text-amber-600 dark:text-amber-400">{part}</span>;
      }
      if (/^\s+$/.test(part)) {
        return <span key={i}>{part}</span>;
      }
      return <span key={i} className="text-apple-label-light dark:text-apple-label-dark">{part}</span>;
    });
  };

  return (
    <div className="relative w-full flex flex-col gap-1.5">
      <div className={`relative flex flex-col bg-white dark:bg-[#1C1C1E] border rounded-xl px-4 py-3 shadow-sm transition-none outline-none ring-0 focus-within:ring-0 focus:outline-none gap-3 ${
        syntaxError 
          ? 'border-apple-red' 
          : 'border-apple-border-light dark:border-apple-border-dark'
      }`}>
        
        {/* LINHA SUPERIOR */}
        <div className="flex items-start gap-3 w-full">
          <Search className={`w-4 h-4 shrink-0 mt-2.5 ${syntaxError ? 'text-apple-red' : 'text-apple-tertiary-light dark:text-apple-tertiary-dark'}`} />

          <div className="flex flex-col flex-1 gap-1.5 min-w-0">
            {mode === 'tags' && tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-[13px] bg-white dark:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark px-2 py-1 rounded-md border border-apple-border-light dark:border-apple-border-dark shadow-sm font-mono font-medium"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(idx)} aria-label="Remover tag" className="text-apple-tertiary-light hover:text-apple-red transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative grid grid-cols-1 items-stretch min-h-[44px] w-full">
              {/* Camada de fundo colorida */}
              <div className="col-start-1 row-start-1 text-[13px] font-mono pointer-events-none whitespace-pre-wrap break-words leading-relaxed py-1.5 px-0 select-none w-full">
                {renderDBQLColoredQuery(inputValue)}
              </div>
              
              {/* Textarea transparente nativa */}
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'tags' && tags.length > 0 ? 'Adicionar mais termos...' : placeholder}
                className={`col-start-1 row-start-1 w-full bg-transparent text-[13px] font-mono outline-none ring-0 border-none shadow-none px-0 py-1.5 text-transparent caret-apple-label-light dark:caret-white z-10 resize-none overflow-hidden leading-relaxed whitespace-pre-wrap break-words focus:outline-none focus:ring-0 ${
                  syntaxError ? 'placeholder-apple-red/60' : 'placeholder-apple-tertiary-light'
                }`}
              />
            </div>
          </div>
        </div>

        {/* LINHA INFERIOR (TODOS OS BOTÕES DE AÇÃO) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-2 border-t border-apple-border-light dark:border-apple-border-dark text-xs">
          <div className="text-[11px] text-apple-tertiary-light truncate">
            {activeSavedQuery ? (
              <span>Consulta ativa: <strong className="text-apple-label-light dark:text-apple-label-dark">{activeSavedQuery.name}</strong> {isQueryModified && <span className="text-apple-blue font-medium">(modificada)</span>}</span>
            ) : (
              <span>Modo livre</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {currentQueryString && (
              <button 
                type="button" 
                onClick={clearAll} 
                aria-label="Limpar consulta"
                className="px-2 py-1 hover:bg-apple-hover dark:hover:bg-[#2C2C2E] rounded-md text-apple-tertiary-light hover:text-apple-label-light transition-colors flex items-center gap-1 font-medium"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}

            {activeSavedQuery && isQueryModified && (
              <button
                type="button"
                onClick={handleQuickUpdate}
                disabled={!!syntaxError}
                aria-label={`Salvar alterações na consulta ${activeSavedQuery?.name || ''}`}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all shadow-sm ${
                  syntaxError 
                    ? 'bg-apple-tertiary-light/20 text-apple-tertiary-light cursor-not-allowed' 
                    : 'bg-apple-blue hover:bg-apple-blue/80 text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" /> Salvar Alterações
              </button>
            )}

            <button 
              type="button" 
              onClick={() => {
                if (syntaxError) return;
                if (activeSavedQuery && !saveName) setSaveName(activeSavedQuery.name);
                setIsSaveModalOpen(true);
              }}
              disabled={!currentQueryString || !!syntaxError}
              aria-label="Salvar Consulta"
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 font-medium ${
                currentQueryString && !syntaxError
                  ? 'hover:bg-apple-hover dark:hover:bg-[#2C2C2E] text-apple-tertiary-light hover:text-apple-blue cursor-pointer' 
                  : 'opacity-40 cursor-not-allowed text-apple-tertiary-light'
              }`}
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-apple-blue" />
              <span>Salvar</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSavedDropdownOpen(!isSavedDropdownOpen)}
                aria-label="Consultas Salvas"
                className="px-2 py-1 hover:bg-apple-hover dark:hover:bg-[#2C2C2E] rounded-md text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-white transition-colors flex items-center gap-1 font-medium"
              >
                <Bookmark className="w-3.5 h-3.5 text-apple-blue" />
                <span>Salvas</span>
                {savedQueries.filter(q => !q.isTemporary).length > 0 && (
                  <span className="text-[10px] bg-apple-blue/10 text-apple-blue px-1.5 py-0.2 rounded-full font-bold">
                    {savedQueries.filter(q => !q.isTemporary).length}
                  </span>
                )}
              </button>

              {isSavedDropdownOpen && (
                <div className="absolute right-0 bottom-9 w-80 bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-bold text-apple-tertiary-light uppercase bg-apple-hover dark:bg-[#2C2C2E] border-b border-apple-border-light dark:border-apple-border-dark flex justify-between items-center">
                    <span>Consultas Salvas e Públicas</span>
                    <a href="/settings/saved-queries" className="text-apple-blue hover:underline text-[10px] lowercase font-normal">gerenciar</a>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-apple-border-light dark:divide-apple-border-dark">
                    {savedQueries.filter(q => !q.isTemporary).length === 0 ? (
                      <div className="p-4 text-center text-xs text-apple-tertiary-light">Nenhuma consulta salva ou pública disponível.</div>
                    ) : (
                      savedQueries.filter(q => !q.isTemporary).map(sq => (
                        <div 
                          key={sq._id}
                          onClick={() => loadSavedQuery(sq)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-apple-hover dark:hover:bg-apple-border-dark cursor-pointer flex items-center justify-between group ${activeSavedQuery?.id === sq._id ? 'bg-apple-blue/5' : ''}`}
                        >
                          <div className="truncate pr-2 flex-1">
                            <p className="font-semibold text-apple-label-light dark:text-apple-label-dark truncate flex items-center gap-1.5">
                              {sq.name}
                              {sq.visibility === 'public' && <Globe className="w-3 h-3 text-emerald-500" />}
                              {sq.visibility === 'shared' && <Share2 className="w-3 h-3 text-apple-blue" />}
                              {activeSavedQuery?.id === sq._id && <span className="w-1.5 h-1.5 rounded-full bg-apple-blue ml-auto"></span>}
                            </p>
                            <p className="font-mono text-[10px] text-apple-tertiary-light truncate">{sq.queryString}</p>
                          </div>
                          {!sq.isSystem && (
                            <button 
                              onClick={(e) => deleteSavedQuery(sq._id, e)}
                              aria-label={`Excluir consulta ${sq.name}`}
                              className="opacity-0 group-hover:opacity-100 text-apple-tertiary-light hover:text-apple-red p-1 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleMode}
              aria-label="Alternar modo DBQL"
              className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors border ${
                mode === 'advanced'
                  ? 'bg-apple-blue/10 text-apple-blue border-apple-blue/20'
                  : 'bg-transparent text-apple-tertiary-light border-transparent hover:bg-apple-hover dark:hover:bg-[#2C2C2E]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>DBQL</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              aria-label="Instruções para Motores de IA"
              className="p-1.5 text-apple-tertiary-light hover:text-emerald-500 transition-colors rounded-md hover:bg-apple-hover dark:hover:bg-[#2C2C2E]"
            >
              <Bot className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              aria-label="Ajuda de Sintaxe DBQL"
              className="p-1.5 text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-white transition-colors rounded-md hover:bg-apple-hover dark:hover:bg-[#2C2C2E]"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {syntaxError && (
        <div className="flex flex-col gap-1.5 text-[12px] text-apple-red mt-1 ml-1 font-medium bg-apple-red/5 p-2.5 rounded-lg border border-apple-red/15">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syntaxError}</span>
          </div>
          <div className="font-mono text-xs bg-white dark:bg-[#1C1C1E] px-3 py-2 rounded-md border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark break-all flex items-center flex-wrap">
            {syntaxErrorIndex !== null && syntaxErrorIndex >= 0 && syntaxErrorIndex < currentQueryString.length ? (
              <>
                <span>{currentQueryString.substring(0, syntaxErrorIndex)}</span>
                <span 
                  className="bg-apple-red/25 dark:bg-apple-red/35 text-apple-red px-1 py-0.5 rounded font-bold border border-apple-red/40 mx-0.5"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255, 59, 48, 0.15) 3px, rgba(255, 59, 48, 0.15) 6px)'
                  }}
                >
                  {currentQueryString.substring(syntaxErrorIndex, syntaxErrorIndex + syntaxErrorLength)}
                </span>
                <span>{currentQueryString.substring(syntaxErrorIndex + syntaxErrorLength)}</span>
              </>
            ) : (
              <span>{currentQueryString}</span>
            )}
          </div>
        </div>
      )}

      {isOpen && suggestions.length > 0 && !syntaxError && (
        <div className="absolute top-24 left-0 right-0 bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="px-4 py-2 text-[11px] font-bold text-apple-tertiary-light uppercase bg-apple-hover dark:bg-[#2C2C2E] border-b border-apple-border-light dark:border-apple-border-dark">
            Sugestões para {activeField}
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-4 py-2.5 text-sm text-apple-label-light dark:text-apple-label-dark hover:bg-apple-hover dark:hover:bg-apple-border-dark transition-colors border-b last:border-b-0 border-apple-border-light dark:border-apple-border-dark"
            >
              <span className="font-medium text-apple-blue mr-1">{activeField}:</span>
              <span>{item.includes(' ') ? `"${item}"` : item}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal Salvar */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={(e) => handleSaveQuerySubmit(e, false)} className="bg-white dark:bg-apple-card-dark rounded-xl max-w-md w-full shadow-2xl p-6 space-y-4 border border-apple-border-light dark:border-apple-border-dark">
            <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">Salvar Consulta DBQL</h3>
            <div>
              <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Nome da Consulta</label>
              <input 
                type="text" 
                value={saveName} 
                onChange={(e) => setSaveName(e.target.value)} 
                placeholder="Ex: Minha Busca Crítica" 
                required 
                autoFocus
                className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent outline-none ring-0 focus:ring-0 text-apple-label-light dark:text-apple-label-dark"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-tertiary-light mb-1">Visibilidade</label>
              <select 
                value={saveVisibility} 
                onChange={(e) => setSaveVisibility(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent text-apple-label-light dark:text-apple-label-dark outline-none ring-0"
              >
                <option value="private">Privada (Apenas para mim)</option>
                <option value="shared">Compartilhada (Com meu Tenant)</option>
                <option value="public">Pública (Global / Template Debit Board)</option>
              </select>
            </div>
            <div className="p-3 bg-apple-hover dark:bg-[#2C2C2E] rounded-lg text-xs font-mono text-apple-secondary-light dark:text-apple-secondary-dark break-all whitespace-pre-wrap">
              {renderDBQLColoredQuery(currentQueryString)}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-apple-hover dark:bg-apple-border-dark text-apple-label-light dark:text-apple-label-dark"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={(e) => handleSaveQuerySubmit(e, true)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-hover dark:bg-[#2C2C2E] text-apple-secondary-light dark:text-apple-secondary-dark border border-apple-border-light dark:border-apple-border-dark hover:border-apple-blue transition-colors"
              >
                Salvar como...
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 rounded-xl text-sm font-medium bg-apple-blue text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirmação Overwrite */}
      {overwriteConfirmQuery && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-apple-card-dark rounded-xl max-w-sm w-full shadow-2xl p-6 space-y-4 border border-apple-border-light dark:border-apple-border-dark text-center">
            <div className="w-10 h-10 rounded-full bg-apple-blue/10 text-apple-blue flex items-center justify-center mx-auto">
              <Save className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark">Substituir consulta salva?</h4>
            <p className="text-xs text-apple-tertiary-light">
              Já existe uma consulta chamada <strong className="text-apple-label-light dark:text-apple-label-dark">"{overwriteConfirmQuery.name}"</strong>. Deseja atualizar os critérios dela?
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setOverwriteConfirmQuery(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-hover dark:bg-apple-border-dark text-apple-label-light dark:text-apple-label-dark"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={() => performSave(overwriteConfirmQuery.name)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-blue text-white"
              >
                Sim, substituir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal IA / Prompt Generator */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-apple-card-dark rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-apple-border-light dark:border-apple-border-dark">
            <div className="flex justify-between items-center p-5 border-b border-apple-border-light dark:border-apple-border-dark bg-apple-hover/30">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">Instruções para Motores de IA (DBQL Prompt)</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} aria-label="Fechar modal" className="text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <p className="text-apple-secondary-light dark:text-apple-secondary-dark">
                Copie o prompt abaixo e cole em qualquer assistente de IA para ensiná-lo a gerar consultas DBQL perfeitamente válidas para o contexto atual (<strong className="text-apple-label-light dark:text-apple-label-dark uppercase">{context}</strong>):
              </p>
              <div className="relative">
                <textarea 
                  readOnly
                  rows={12}
                  className="w-full font-mono text-[11px] bg-apple-hover dark:bg-[#1C1C1E] p-3 rounded-lg border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark select-all resize-none outline-none"
                  value={`Você é um especialista em engenharia de dados e arquitetura de segurança no Debit Board. Sua tarefa é gerar strings de busca em formato DBQL (Debit Board Query Language) válidas com base nos pedidos do usuário.

REGRAS DE SINTAXE DBQL:
1. Operadores lógicos aceitos (case-insensitive): and, or, not.
2. Negação: Utilize '!' ou 'not'.
3. Agrupamento: Utilize parênteses '()'.
4. Wildcards: Utilize '*'.
5. Valores com espaços entre aspas duplas.

CONTEXTO ATUAL: '${context}'
PROPRIEDADES:
${HELP_PROPERTIES[context]?.map(p => `- ${p.prop}: ${p.desc} (Ex: ${p.ex})`).join('\n')}

Responda estritamente com a query DBQL solicitada.`}
                />
              </div>
            </div>
            <div className="p-4 border-t border-apple-border-light dark:border-apple-border-dark flex justify-end">
              <button 
                type="button"
                onClick={() => {
                  const text = `Você é um especialista em engenharia de dados e arquitetura de segurança no Debit Board...`;
                  navigator.clipboard.writeText(text);
                  alert('Prompt copiado para a área de transferência!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-apple-blue text-white flex items-center gap-1.5"
              >
                Copiar Prompt para IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajuda */}
      {isHelpModalOpen && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-apple-card-dark rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-apple-border-light dark:border-apple-border-dark">
              <div className="flex justify-between items-center p-5 border-b border-apple-border-light dark:border-apple-border-dark">
                <h3 className="text-xl font-bold text-apple-label-light dark:text-apple-label-dark">DBQL - Guia de Sintaxe Avançada</h3>
                <button onClick={() => setIsHelpModalOpen(false)} aria-label="Fechar ajuda" className="text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div>
                  <h4 className="text-sm font-bold text-apple-label-light dark:text-apple-label-dark mb-2">Operadores Lógicos e Agrupamentos</h4>
                  <ul className="list-disc pl-5 text-xs space-y-1 text-apple-secondary-light dark:text-apple-secondary-dark">
                    <li><strong className="text-apple-label-light dark:text-apple-label-dark font-mono">and</strong> / <strong className="text-apple-label-light dark:text-apple-label-dark font-mono">or</strong>: Conectam condições lógicas.</li>
                    <li><strong className="text-apple-label-light dark:text-apple-label-dark font-mono">!</strong> / <strong className="text-apple-label-light dark:text-apple-label-dark font-mono">not</strong>: Negação de termos.</li>
                    <li><strong className="text-apple-label-light dark:text-apple-label-dark font-mono">()</strong>: Agrupamento por parênteses.</li>
                    <li><strong className="text-apple-label-light dark:text-apple-label-dark font-mono">*</strong>: Wildcard de correspondência.</li>
                  </ul>
                </div>

                <div className="border border-apple-border-light dark:border-apple-border-dark rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-apple-hover dark:bg-[#2C2C2E] border-b border-apple-border-light dark:border-apple-border-dark text-xs font-bold uppercase text-apple-tertiary-light">
                    Propriedades para o contexto: {context}
                  </div>
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-apple-hover/50 dark:bg-[#2C2C2E]/50 border-b border-apple-border-light dark:border-apple-border-dark">
                      <tr>
                        <th className="p-3 text-apple-tertiary-light font-semibold">Propriedade</th>
                        <th className="p-3 text-apple-tertiary-light font-semibold">Descrição</th>
                        <th className="p-3 text-apple-tertiary-light font-semibold">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
                      {HELP_PROPERTIES[context]?.map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-mono text-apple-label-light dark:text-apple-label-dark">{p.prop}</td>
                          <td className="p-3 text-apple-secondary-light dark:text-apple-secondary-dark">{p.desc}</td>
                          <td className="p-3 font-mono text-apple-label-light dark:text-apple-label-dark">{p.ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
         </div>
      )}
    </div>
  );
}