// components/dbql/DBQLAdvancedSearch.tsx
'use client';

import { useState, useRef, useEffect, useMemo, useTransition, CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, X, Code2, HelpCircle, AlertCircle, BookmarkPlus, 
  Bookmark, Check, Bot, Trash2, Copy,
  PlayCircleIcon
} from 'lucide-react';
import DBQLRichInput from './DBQLRichInput';
import DBQLHelpModal from './DBQLHelpModal';
import DBQLSuggestions from './DBQLSuggestions';

/**
 * Propriedades do componente AdvancedSearch.
 */
interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: 'issues' | 'stats' | 'projects' | 'repositories';
  userId: string;
  onManageQueries?: () => void;
}

const STORAGE_KEY_MODE = 'debitboard_search_mode';

const MEME_QUIPS = [
  "Houston, temos um problema lógico: 'You shall not pass!' 🧙‍♂️",
  "Inception booleana detectada: operador lógico dentro de operador.",
  "Matrix corrompida: tentar misturar tantos operadores vai acordar o Neo.",
  "Erro 418: Sou um bule de chá, mas até eu sei que essa sintaxe não faz sentido!",
  "Stack overflow de tokens: operadores encadeados demais para uma única query."
];

/**
 * Hook para detectar cliques fora de um elemento (útil para fechar modais/dropdowns).
 * @param ref - Referência do elemento que deve ser monitorado.
 * @param callback - Função executada ao clicar fora.
 */
const useOutsideClick = (ref: React.RefObject<HTMLElement>, callback: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, callback]);
};

interface ValidationError {
  error: string;
  highlightIndex: number | null;
  errorLength: number;
}

/**
 * Componente de Busca Avançada utilizando DebitBoard Query Language (DBQL).
 * Suporta modo tags, modo DBQL livre, salvamento de consultas e validação ao vivo.
 */
export default function DBQLAdvancedSearch({
  onSearch,
  placeholder = 'Buscar... ex: category:"Broken Access Control" and severity:high',
  context = 'issues',
  userId = '',
  onManageQueries
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
  const [savedDropdownStyle, setSavedDropdownStyle] = useState<CSSProperties>({});
  const [activeSavedQuery, setActiveSavedQuery] = useState<{ id: string; name: string; queryString: string, visibility: 'private' | 'shared' | 'public' | 'temporary' } | null>(null);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiNaturalInput, setAiNaturalInput] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const savedButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tempQueryIdRef = useRef<string | null>(null);

  const savedDropdownRef = useRef<HTMLDivElement>(null);
  const helpModalRef = useRef<HTMLDivElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const aiModalRef = useRef<HTMLDivElement>(null);

  useOutsideClick(savedDropdownRef, () => setIsSavedDropdownOpen(false));
  useOutsideClick(helpModalRef, () => setIsHelpModalOpen(false));
  useOutsideClick(saveModalRef, () => setIsSaveModalOpen(false));
  useOutsideClick(aiModalRef, () => setIsAiModalOpen(false));

  const handleSuggestionSelect = (selectedValue: string) => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData) return;

    const formattedValue = selectedValue.includes(' ') ? `"${selectedValue}"` : selectedValue;

    const lastIndex = inputValue.lastIndexOf(tokenData.rawToken);
    if (lastIndex !== -1) {
      const before = inputValue.substring(0, lastIndex);
      // Usamos o tokenData.operator ao invés de fixar ':'
      const newRawToken = tokenData.rawToken.replace(tokenData.cleanToken, `${tokenData.fieldKey}${tokenData.operator}${formattedValue}`);
      
      const newValue = before + newRawToken + ' '; 
      setInputValue(newValue);
    }
    
    setIsOpen(false);
    setSuggestions([]);
    setActiveField(null);
  };

  /**
   * Valida a string DBQL em tempo real procurando por erros de sintaxe (parênteses, aspas ou operadores mal formados).
   * @param {string} query - A query crua do input.
   * @returns {ValidationError[]} - Lista de erros encontrados.
   */
  const validateDBQL = (query: string): ValidationError[] => {
    if (!query) return [];
    const errors: ValidationError[] = [];

    const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    let searchIndex = 0;
    
    let looseTextStart: number | null = null;
    let looseTextEnd: number | null = null;
    let looseTextContent = '';

    tokens.forEach(token => {
      const cleanToken = token.replace(/^[\(]+|[\)]+$/g, '');
      const tokenIndex = query.indexOf(token, searchIndex);
      
      if (cleanToken !== '') {
        const lower = cleanToken.toLowerCase();
        const isOperator = ['and', 'or', 'not'].includes(lower);
        // Atualizado para validar os novos operadores além de ":"
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
              error: `Texto solto ou sintaxe não reconhecida: "${looseTextContent}" (Termos literais múltiplos requerem aspas duplas)`,
              highlightIndex: looseTextStart,
              errorLength: looseTextEnd - looseTextStart
            });
            looseTextStart = null;
            looseTextEnd = null;
            looseTextContent = '';
          }
        }
      }
      searchIndex = tokenIndex + token.length;
    });

    if (looseTextStart !== null && looseTextEnd !== null) {
      errors.push({
        error: `Texto solto ou sintaxe não reconhecida: "${looseTextContent}" (Termos literais múltiplos requerem aspas duplas)`,
        highlightIndex: looseTextStart,
        errorLength: looseTextEnd - looseTextStart
      });
    }

    const stack: number[] = [];
    for (let i = 0; i < query.length; i++) {
      if (query[i] === '(') {
        stack.push(i);
      } else if (query[i] === ')') {
        if (stack.length > 0) stack.pop();
        else errors.push({ error: 'Erro de sintaxe: Parêntese fechado sem abertura correspondente.', highlightIndex: i, errorLength: 1 });
      }
    }
    if (stack.length > 0) {
      errors.push({ error: 'Erro de sintaxe: Parêntese aberto não foi fechado.', highlightIndex: stack[stack.length - 1], errorLength: 1 });
    }

    if (/\(\s*\)[\)]*/.test(query)) {
      const match = query.match(/\(\s*\)/);
      errors.push({ error: 'Erro de sintaxe: Agrupamento vazio ( ).', highlightIndex: match?.index ?? 0, errorLength: match ? match[0].length : 2 });
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
      errors.push({ error: 'Erro de sintaxe: Aspas duplas não fechadas.', highlightIndex: firstUnclosedQuote, errorLength: 1 });
    }

    const chaoticRegex = /\b(and|or|not)\s+(and|or|not)\s+(and|or|not)\b/i;
    const chaoticMatch = chaoticRegex.exec(query);
    if (chaoticMatch) {
      const randomMeme = MEME_QUIPS[Math.floor(Math.random() * MEME_QUIPS.length)];
      errors.push({ error: `${randomMeme} (Detectado: '${chaoticMatch[0]}')`, highlightIndex: chaoticMatch.index ?? 0, errorLength: chaoticMatch[0].length });
    }

    return errors.slice(0, 3);
  };

  const hasComplexSyntax = (q: string): boolean => 
  /[\(\)!\*]|\b(>=|<=|>|<|!=|:|=|and|or|not)\b/i.test(q);

  const parseInputToTags = (input: string): string[] => {
    // Adicionado os operadores no Regex
    const regex = /(?:(?:and|or)\s+not\s+|(?:and|or|not)\s+)?!?[a-zA-Z0-9_]+(>=|<=|>|<|!=|:|=)(?:"[^"]*"|[^\s\(\)]+)/gi;
    const matches = input.match(regex) || [];
    return matches.map(m => m.trim());
  };

  const getEditingToken = (text: string) => {
    const tokens = text.split(/(?=\b(?:and|or|not)\b|\s)/i).map(t => t.trim()).filter(Boolean);
    const currentToken = tokens[tokens.length - 1] || '';
    const cleanToken = currentToken.replace(/^[\(!]+|\b(?:and\s+not|or\s+not|not|and|or)\s+/gi, '');
    
    // Agora capturamos o operador dinamicamente
    const match = cleanToken.match(/^([a-zA-Z0-9_]+)(>=|<=|>|<|!=|:|=)(.*)$/);
    if (!match) return null;
    
    const fieldKey = match[1];
    const operator = match[2];
    const rawQuery = match[3];
    const query = rawQuery.replace(/^"/, '');
    
    return { rawToken: currentToken, cleanToken, fieldKey, operator, query };
  };

  const fetchSavedQueries = async () => {
    try {
      const res = await fetch(`/api/saved-queries?context=${context}`);
      if (res.ok) {
        const data = await res.json();
        setSavedQueries(data);
        const existingTemp = data.find((q: any) => q.visibility === 'temporary');
        if (existingTemp) tempQueryIdRef.current = existingTemp._id;
        
        if (rawUrlQueryId) {
          const matched = data.find((q: any) => q._id === rawUrlQueryId || q.slug === rawUrlQueryId);
          if (matched) {
            setActiveSavedQuery({ id: matched._id, name: matched.name, queryString: matched.queryString, visibility: matched.visibility });
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

  const syntaxErrors = useMemo(() => validateDBQL(currentQueryString), [currentQueryString]);

  useEffect(() => {
    const tokenData = getEditingToken(inputValue);
    if (!tokenData || !tokenData.fieldKey || tokenData.query.includes('*')) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveField(null);
      return;
    }

    setActiveField(tokenData.fieldKey);

    // Hardcode para 'severity' para não depender da API falhar
    if (tokenData.fieldKey.toLowerCase() === 'severity') {
      const severities = ['critical', 'high', 'medium', 'low', 'info'];
      const queryLower = tokenData.query.toLowerCase();
      // Sugere se começar com a digitação, e remove da lista se já for exatamente o que está digitado
      const filtered = severities.filter(s => s.startsWith(queryLower) && s !== queryLower);
      
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
      return;
    }

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
          // Remove duplicados absolutos com o Set
          const list = Array.from(new Set(data.suggestions || data.values || []))
            .filter((item): item is string => typeof item === 'string');
          
          // O "Pulo do Gato": Limitar a 10 itens E remover da lista a palavra que já foi digitada
          const queryLower = tokenData.query.toLowerCase();
          const filtered = list
            .filter(item => item.toLowerCase() !== queryLower)
            .slice(0, 10);

          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
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

  /**
   * Sincroniza a busca com os parâmetros de URL, garantindo que consultas salvas 
   * preservem seu ID no parâmetro "q", em vez de gerar novas consultas temporárias indiscriminadamente.
   * 
   * @param {string} fullQuery - A string consolidada que será buscada.
   * @param {'tags' | 'advanced'} currentMode - Modo no qual a consulta foi originada.
   * @param {string} [explicitQueryId] - Força a injeção de um ID (usado ao selecionar uma query listada).
   */
  const updateAndSearch = async (fullQuery: string, currentMode: 'tags' | 'advanced', explicitQueryId?: string) => {
    if (syntaxErrors.length > 0) return;
    const modeParamVal = currentMode === 'advanced' ? 'a' : 't';
    sessionStorage.setItem(STORAGE_KEY_MODE, currentMode);
    
    // Inicia utilizando o ID passado (ex: clique no menu dropdown) ou o da URL
    let queryRefId = explicitQueryId || rawUrlQueryId;

    if (fullQuery) {
      // Se não temos um ID explícito, mas a query digitada for idêntica à que já está ativa (salva),
      // amarramos novamente ao ID oficial dela ao invés de forçar temporária.
      if (!explicitQueryId && activeSavedQuery && fullQuery === activeSavedQuery.queryString) {
         queryRefId = activeSavedQuery.id;
      }
      
      // Se realmente não amarrou a nenhuma consulta salva, lida com criação de query temporária.
      if (!queryRefId || queryRefId === tempQueryIdRef.current) {
        try {
          if (tempQueryIdRef.current) {
            await fetch('/api/saved-queries', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: tempQueryIdRef.current, name: `Temporária (${context})`, queryString: fullQuery, context, visibility: 'temporary', userId: userId })
            });
            queryRefId = tempQueryIdRef.current;
          } else {
            // Alterar o POST do temporário para salvar com visibility correta
            const res = await fetch('/api/saved-queries', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: `Temporária (${context})`, queryString: fullQuery, context, visibility: 'temporary', userId: userId })
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
      }
    } else {
      queryRefId = '';
    }

    const params = new URLSearchParams(window.location.search);
    if (queryRefId) params.set('q', queryRefId);
    else params.delete('q');
    
    // Aqui nós removemos o parâmetro se não for avançado para manter a URL limpa!
    if (currentMode === 'advanced') {
      params.set('m', 'a');
    } else {
      params.delete('m');
    }
    params.delete('mode');
    
    window.history.replaceState(null, '', `?${params.toString()}`);
    
    startTransition(() => { if (onSearch) onSearch(fullQuery); });
  };

  const handleExecuteSearch = () => {
  if (syntaxErrors.length > 0) return;

  if (mode === 'advanced') {
    updateAndSearch(inputValue, mode);
  } else {
    const trimmedInput = inputValue.trim();
    if (trimmedInput) {
      // Se a string tiver sintaxe avançada, muda para modo advanced
      if (hasComplexSyntax(trimmedInput)) {
        setMode('advanced');
        setInputValue(trimmedInput);
        updateAndSearch(trimmedInput, 'advanced');
      } else {
        // Comportamento normal: adiciona como tag
        const newTags = [...tags, trimmedInput];
        setTags(newTags);
        setInputValue('');
        updateAndSearch(newTags.join(' '), mode);
      }
    } else {
      // Apenas busca as tags existentes
      updateAndSearch(tags.join(' '), mode);
    }
  }
  setIsOpen(false);
};

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecuteSearch();
    } else if (e.key === 'Backspace' && mode === 'tags' && !inputValue && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      updateAndSearch(newTags.join(' '), mode);
    }
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
      if (validateDBQL(fullQuery.trim()).length === 0) updateAndSearch(fullQuery.trim(), 'advanced');
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

  const clearAll = () => {
    setTags([]);
    setInputValue('');
    setSuggestions([]);
    setActiveSavedQuery(null);
    tempQueryIdRef.current = null;
    updateAndSearch('', mode);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || !currentQueryString) return;

    try {
      const res = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          queryString: currentQueryString,
          context,
          visibility: saveVisibility
        })
      });
      if (res.ok) {
        const saved = await res.json();
        setActiveSavedQuery({ id: saved._id, name: saved.name, queryString: saved.queryString, visibility: saved.visibility });
        setIsSaveModalOpen(false);
        setSaveName('');
        tempQueryIdRef.current = null;
        fetchSavedQueries();
      }
    } catch (err) {
      console.error('Erro ao salvar query', err);
    }
  };

  const handleUpdateActiveQuery = async () => {
    if (!activeSavedQuery || !isQueryModified) return;
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
        setActiveSavedQuery({ ...activeSavedQuery, queryString: currentQueryString });
        fetchSavedQueries();
      }
    } catch (err) {
      console.error('Erro ao atualizar query salva', err);
    }
  };

  const handleDeleteSavedQuery = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Deseja realmente excluir esta consulta salva?")) return;
    try {
      const res = await fetch(`/api/saved-queries?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeSavedQuery?.id === id) {
          setActiveSavedQuery(null);
        }
        fetchSavedQueries();
      }
    } catch (err) {
      console.error('Erro ao excluir query salva', err);
    }
  };

  const handleToggleSavedDropdown = () => {
    if (!isSavedDropdownOpen && savedButtonRef.current) {
      const rect = savedButtonRef.current.getBoundingClientRect();
      setSavedDropdownStyle({
        position: 'fixed',
        bottom: `${window.innerHeight - (rect.top + 320)}px`,
        right: `${window.innerWidth - rect.right}px`,
        width: '320px',
        zIndex: 9999
      });
    }
    setIsSavedDropdownOpen(!isSavedDropdownOpen);
  };


  const generatedAiPromptText = `Você é um assistente especialista na Debit Board Query Language (DBQL).
Contexto atual da interface: ${context} (AdvancedQuery - DBQL).

Abaixo está a documentação técnica oficial da sintaxe DBQL para você seguir rigorosamente ao gerar consultas:

🔍 Estrutura Básica:
- Padrão: propriedade:valor
- Valores com espaços ou caracteres especiais devem ser envolvidos em aspas duplas (" "). Ex: category:"Broken Access Control"

📋 Propriedades Disponíveis:
- category: Categoria da vulnerabilidade (ex: category:"Broken Access Control")
- severity: Severidade (critical, high, medium, low) -> Ex: severity:critical
- branch: Nome do branch (ex: branch:main)
- project: Nome do projeto (ex: project:GEPIN_AS)
- repository: Nome do repositório (ex: repository:my-backend-api)
- status: Status atual (new, open, resolved, recurring, wont_fix)
- is: Filtros especiais (ex: is:unresolved)
- fileName: Nome do arquivo, suporta curingas (*) -> Ex: fileName:*Controller.cs

⚙️ Operadores Lógicos e Símbolos:
- AND: Ambas as condições verdadeiras (ex: branch:main AND severity:critical)
- OR: Pelo menos uma condição verdadeira (ex: severity:high OR severity:critical)
- NOT ou !: Negação/exclusão (ex: !branch:main ou NOT branch:develop)
- ( ): Agrupamento para precedência (ex: (severity:critical OR severity:high))
- * (Wildcard): Curinga aplicável aos valores (ex: fileName:*Service.cs)

⭐ Precedência:
1. () -> 2. ! / NOT -> 3. AND -> 4. OR (Sempre agrupe OR com parênteses quando misturado com AND).

Solicitação do usuário em linguagem natural:
"${aiNaturalInput}"

Por favor, retorne APENAS a string da consulta DBQL resultante, perfeitamente formatada e pronta para uso.`;

  const realSavedQueries = savedQueries.filter(q => !q.isTemporary);

  return (
    <div className="relative w-full flex flex-col gap-1.5">
      <div className={`relative flex flex-col bg-white dark:bg-[#1C1C1E] border rounded-xl px-4 py-3 shadow-sm transition-none outline-none ring-0 focus-within:ring-0 focus:outline-none gap-3 ${
        syntaxErrors.length > 0 ? 'border-apple-red' : 'border-apple-border-light dark:border-apple-border-dark'
      }`}>
        <div className="flex items-start gap-3 w-full">
          <Search className={`w-4 h-4 shrink-0 mt-2.5 ${syntaxErrors.length > 0 ? 'text-apple-red' : 'text-apple-tertiary-light'}`} />

          <div className="flex flex-col flex-1 gap-1.5 min-w-0">
            {mode === 'tags' && tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 text-[13px] bg-white dark:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark px-2 py-1 rounded-md border border-apple-border-light dark:border-apple-border-dark shadow-sm font-mono font-medium">
                    {tag}
                    <button type="button" onClick={() => removeTag(idx)} className="text-apple-tertiary-light hover:text-apple-red transition-colors">
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
              
              {/* Adicione o novo dropdown AQUI */}
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
              <button type="button" onClick={clearAll} className="text-apple-tertiary-light hover:text-apple-red transition-colors flex items-center gap-1">
                <X className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
            {activeSavedQuery && activeSavedQuery.visibility !== 'temporary' && (
              <div className="flex ml-5 items-center gap-1.5 border-l border-apple-border-light px-7">
                <span 
                  className={`w-2 h-2 rounded-full ${isQueryModified ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} 
                  title={isQueryModified ? 'Consulta modificada (alterações não salvas)' : 'Consulta salva e sincronizada'}
                />
                <span>Consulta: <strong className="text-apple-label-light dark:text-apple-label-dark">{activeSavedQuery.name}</strong></span>
                {isQueryModified && <span className="text-amber-500 font-semibold text-[10px]">(modificada)</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {activeSavedQuery && isQueryModified && (
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
              onClick={() => setIsSaveModalOpen(true)}
              disabled={!currentQueryString || syntaxErrors.length > 0}
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

              {isSavedDropdownOpen && (
                <div 
                  ref={savedDropdownRef}
                  style={savedDropdownStyle}
                  className="bg-white dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl shadow-lg p-2 z-50 flex flex-col gap-1 max-h-72 overflow-y-auto"
                >
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-apple-border-light dark:border-apple-border-dark mb-1">
                    <span className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">CONSULTAS SALVAS E PÚBLICAS</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSavedDropdownOpen(false);
                        if (onManageQueries) onManageQueries();
                        else window.location.href = '/settings/saved-queries';
                      }}
                      className="text-xs text-apple-blue hover:underline font-medium"
                    >
                      gerenciar
                    </button>
                  </div>

                  {realSavedQueries.length === 0 ? (
                    <div className="text-xs text-apple-tertiary-light px-2 py-4 text-center">Nenhuma consulta salva ainda.</div>
                  ) : (
                    realSavedQueries.map((q) => (
                      <div
                        key={q._id}
                        onClick={() => {
                          const targetMode = hasComplexSyntax(q.queryString) ? 'advanced' : 'tags';
                          setActiveSavedQuery({ id: q._id, name: q.name, queryString: q.queryString, visibility: q.visibility || 'private' });
                          if (targetMode === 'advanced') {
                            setMode('advanced');
                            setInputValue(q.queryString);
                          } else {
                            setMode('tags');
                            setTags(parseInputToTags(q.queryString));
                          }
                          // IMPORTANTE: passa o ID forçado para que a URL seja reconstruída com o Q param correto.
                          updateAndSearch(q.queryString, targetMode, q._id);
                          setIsSavedDropdownOpen(false);
                        }}
                        className={`group relative text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-apple-border-light/30 transition-colors cursor-pointer ${
                          activeSavedQuery?.id === q._id ? 'bg-apple-blue/10 text-apple-blue font-semibold' : 'text-apple-label-light dark:text-apple-label-dark'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="font-medium truncate">{q.name}</span>
                          <span className="font-mono text-[10px] text-apple-tertiary-light truncate">{q.queryString}</span>
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
                mode === 'advanced' ? 'bg-apple-blue/10 text-apple-blue border-apple-blue/20' : 'text-apple-tertiary-light border-transparent hover:border-apple-border-light'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>DBQL</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              title="Gerar com IA"
              className="p-1.5 rounded-md text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
            >
              <Bot className="w-4 h-4" />
            </button>

            {/* Botão que abre o modal */}
            <button 
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="ml-2 p-2 text-gray-400 hover:text-[#007AFF] transition-colors"
              title="Ajuda DBQL"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Instância do Modal Desacoplado */}
            <DBQLHelpModal 
              isOpen={isHelpModalOpen} 
              onClose={() => setIsHelpModalOpen(false)} 
              context={context} 
            />
            
          </div>
        </div>
      </div>

      {syntaxErrors.length > 0 && (
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
                    <span>{currentQueryString.substring(Math.max(0, err.highlightIndex - 10), err.highlightIndex)}</span>
                    <span className="bg-apple-red/25 text-apple-red px-1 py-0.5 rounded font-bold mx-0.5">
                      {currentQueryString.substring(err.highlightIndex, err.highlightIndex + err.errorLength)}
                    </span>
                    <span>{currentQueryString.substring(err.highlightIndex + err.errorLength, err.highlightIndex + err.errorLength + 10)}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* MODAL DE SALVAR CONSULTA */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div ref={saveModalRef} className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark">Salvar Consulta DBQL</h3>
            <form onSubmit={handleSaveSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-apple-tertiary-light">Nome da consulta</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ex: Issues Críticas de Segurança"
                  className="px-3 py-2 bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-apple-tertiary-light">Visibilidade</label>
                <select
                  value={saveVisibility}
                  onChange={(e) => setSaveVisibility(e.target.value as any)}
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

      {/* MODAL DE AJUDA DBQL */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div ref={helpModalRef} className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark">Guia de Sintaxe DBQL</h3>
              <button onClick={() => setIsHelpModalOpen(false)} className="text-apple-tertiary-light hover:text-apple-label-light">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-xs text-apple-label-light dark:text-apple-label-dark">
              <p>O DBQL (DebitBoard Query Language) permite criar filtros de busca avançados combinando campos, operadores lógicos e termos literais.</p>
              <div className="font-semibold text-apple-blue mt-1">Exemplos de Campos:</div>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                <li>category:&quot;Broken Access Control&quot;</li>
                <li>severity:high</li>
                <li>project:GEPIN_AS</li>
                <li>!fileName:Auth*.cs (negação com !)</li>
              </ul>
              <div className="font-semibold text-apple-blue mt-1">Operadores Lógicos:</div>
              <p className="font-mono text-[11px]">AND, OR, NOT (devem ser em letras maiúsculas ou minúsculas na sintaxe booleana).</p>
              <div className="font-semibold text-apple-blue mt-1">Regra de Textos Soltos:</div>
              <p>Termos soltos compostos por mais de uma palavra sem aspas duplas são agrupados e sinalizados como um bloco de erro único para que você os envolva corretamente em aspas se forem literais.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IA COM PROMPT MANUAL E DOCUMENTAÇÃO DA DBQL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div ref={aiModalRef} className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-apple-label-light dark:text-apple-label-dark flex items-center gap-2">
                <Bot className="w-4 h-4 text-apple-blue" />
                <span>Gerar Query com IA (Copiar Prompt)</span>
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-apple-tertiary-light hover:text-apple-label-light">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-apple-tertiary-light">
                Descreva abaixo o que deseja buscar. O sistema vai gerar um prompt estruturado contendo todas as regras da sintaxe DBQL e o contexto atual (<code className="text-apple-blue">{context}</code>) para você colar na sua IA favorita.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Sua busca em linguagem natural:</label>
                <textarea
                  value={aiNaturalInput}
                  onChange={(e) => {
                    setAiNaturalInput(e.target.value);
                    setCopiedPrompt(false);
                  }}
                  rows={3}
                  placeholder="Ex: Quero todas as issues de severidade crítica ou alta do projeto GEPIN que não sejam do arquivo Auth"
                  className="w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl p-3 text-xs outline-none focus:border-apple-blue text-apple-label-light dark:text-apple-label-dark resize-none font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider">Prompt gerado com a documentação DBQL:</label>
                  <span className="text-[10px] text-apple-tertiary-light">Pronto para envio</span>
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