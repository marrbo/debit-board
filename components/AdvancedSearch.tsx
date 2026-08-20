// components/AdvancedSearch.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X, Code2, Tag, HelpCircle, AlertCircle } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: 'issues' | 'stats' | 'projects' | 'repositories';
}

const STORAGE_KEY_QUERY = 'debitboard_global_query';
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
    { prop: 'tech', desc: 'Stack tecnológica', ex: 'tech:Next.js' },
  ],
  repositories: [
    { prop: 'name', desc: 'Nome do repositório', ex: 'name:backend-api' },
    { prop: 'branch', desc: 'Branch principal', ex: 'branch:main' },
  ]
};

export default function AdvancedSearch({
  onSearch,
  placeholder = 'Buscar... ex: category:"Broken Access Control"',
  context = 'issues'
}: AdvancedSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlMode = searchParams.get('mode');

  const [mode, setMode] = useState<'tags' | 'advanced'>('tags');
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🛡️ Linter DBQL refinado
  const validateDBQL = (query: string): string | null => {
    if (!query) return null;

    let openCount = 0;
    for (let i = 0; i < query.length; i++) {
      if (query[i] === '(') openCount++;
      if (query[i] === ')') openCount--;
      if (openCount < 0) return 'Erro de sintaxe: Parêntese fechado sem ter sido aberto.';
    }
    if (openCount > 0) return 'Erro de sintaxe: Parêntese aberto sem fechamento.';
    if (/\(\s*\)/.test(query)) return 'Erro de sintaxe: Agrupamento vazio ( ).';

    if (/(?:NOT\s+!|!\s*NOT)/i.test(query)) return 'Erro de sintaxe: Uso redundante de negação (NOT junto de !).';
    if (/\b(?:AND|OR)\s+NOT\s+!/i.test(query)) return 'Erro de sintaxe: Combinação inválida de "AND/OR NOT" seguido de "!".';
    if (/\b(AND|OR)\s+(AND|OR)\b/i.test(query)) return 'Erro de sintaxe: Operadores lógicos duplicados.';

    return null;
  };

  const hasComplexSyntax = (query: string): boolean => {
    return /[\(\)!\*]/.test(query);
  };

  const parseInputToTags = (input: string): string[] => {
    const regex = /(?:(?:AND|OR)\s+NOT\s+|(?:AND|OR|NOT)\s+)?!?[a-zA-Z0-9_]+:(?:"[^"]*"|\S+)/gi;
    const matches = input.match(regex) || [];
    return matches.map(m => m.trim());
  };

  const getEditingToken = (text: string) => {
    const tokens = text.split(/(?=\b(?:AND|OR)\b|\s)/).map(t => t.trim()).filter(Boolean);
    const currentToken = tokens[tokens.length - 1] || '';
    const cleanToken = currentToken.replace(/^[\(!]+|\b(?:AND\s+NOT|OR\s+NOT|NOT|AND|OR)\s+/i, '');

    if (!cleanToken.includes(':')) return null;

    const colonIndex = cleanToken.indexOf(':');
    const fieldKey = cleanToken.substring(0, colonIndex).trim();
    const rawQuery = cleanToken.substring(colonIndex + 1).trim();
    const query = rawQuery.replace(/^"/, '');

    return { rawToken: currentToken, cleanToken, fieldKey, query };
  };

  useEffect(() => {
    const storedQuery = urlQuery || sessionStorage.getItem(STORAGE_KEY_QUERY) || '';
    const storedMode = urlMode || sessionStorage.getItem(STORAGE_KEY_MODE) || 'tags';

    if (storedQuery) {
      if (hasComplexSyntax(storedQuery) || storedMode === 'advanced') {
        setMode('advanced');
        setInputValue(storedQuery);
      } else {
        setMode('tags');
        setTags(parseInputToTags(storedQuery));
      }
    } else {
      setMode(storedMode as 'tags' | 'advanced');
    }
  }, [urlQuery, urlMode]);

  useEffect(() => {
    const queryToValidate = mode === 'advanced' 
      ? inputValue 
      : [...tags, inputValue].filter(Boolean).join(' ');
    
    setSyntaxError(validateDBQL(queryToValidate));
  }, [inputValue, tags, mode]);

  useEffect(() => {
    const tokenData = getEditingToken(inputValue);

    if (!tokenData || !tokenData.fieldKey || tokenData.query.includes('*')) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveField(null);
      return;
    }

    setActiveField(tokenData.fieldKey);
    setIsLoading(true);

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
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [inputValue, context]);

  const updateAndSearch = (fullQuery: string, currentMode: 'tags' | 'advanced') => {
    if (syntaxError) return;

    sessionStorage.setItem(STORAGE_KEY_QUERY, fullQuery);
    sessionStorage.setItem(STORAGE_KEY_MODE, currentMode);
    
    const params = new URLSearchParams(searchParams);
    if (fullQuery) params.set('q', fullQuery);
    else params.delete('q');
    params.set('mode', currentMode);
    
    router.replace(`?${params.toString()}`, { scroll: false });
    if (onSearch) onSearch(fullQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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

    const formattedVal = suggestion.includes(' ') && !suggestion.startsWith('"')
      ? `"${suggestion}"` : suggestion;

    const prefixMatch = tokenData.rawToken.match(/^([\(!]+|\b(?:AND\s+NOT|OR\s+NOT|NOT|AND|OR)\s+)/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    const newToken = `${prefix}${tokenData.fieldKey}:${formattedVal}`;

    if (mode === 'advanced') {
      const tokens = inputValue.split(/(?=\b(?:AND|OR)\b|\s)/).map(t => t.trim()).filter(Boolean);
      tokens[tokens.length - 1] = newToken;
      const newQuery = tokens.join(' ');
      setInputValue(newQuery);
      if (!validateDBQL(newQuery)) updateAndSearch(newQuery, mode);
    } else {
      const newTags = [...tags, newToken];
      setTags(newTags);
      if (!validateDBQL(newTags.join(' '))) updateAndSearch(newTags.join(' '), mode);
      setInputValue('');
    }

    setSuggestions([]);
    setIsOpen(false);
    setActiveField(null);
    if (inputRef.current) inputRef.current.focus();
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
      if (!validateDBQL(fullQuery.trim())) updateAndSearch(fullQuery.trim(), 'advanced');
    } else {
      if (hasComplexSyntax(inputValue)) {
        alert("Não é possível voltar para o modo padrão. A consulta possui sintaxes exclusivas do modo avançado, como parênteses (), exclamações ! ou asteriscos *.");
        return;
      }
      if (syntaxError) {
        alert("Corrija os erros de sintaxe antes de alternar os modos.");
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
    setIsOpen(false);
    setSyntaxError(null);
    updateAndSearch('', mode);
  };

  const currentProps = HELP_PROPERTIES[context] || HELP_PROPERTIES['issues'];

  return (
    <div className="relative w-full flex flex-col gap-1">
      <div className={`flex items-center gap-2 bg-white dark:bg-[#1C1C1E] border rounded-xl px-4 py-2 shadow-sm transition-all focus-within:ring-2 ${
        syntaxError 
          ? 'border-[#FF3B30] focus-within:ring-[#FF3B30]/30' 
          : 'border-[#D1D1D6] dark:border-[#38383A] focus-within:ring-[#007AFF]/30'
      }`}>
        <Search className={`w-4 h-4 shrink-0 ${syntaxError ? 'text-[#FF3B30]' : 'text-[#8E8E93] dark:text-[#636366]'}`} />

        {mode === 'tags' && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 text-[13px] bg-white dark:bg-[#2C2C2E] text-[#333333] dark:text-[#F2F2F7] px-2 py-1 rounded-md border border-[#E5E5EA] dark:border-[#38383A] shadow-sm font-medium"
              >
                {tag}
                <button type="button" onClick={() => removeTag(idx)} className="text-[#8E8E93] hover:text-[#FF3B30] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'tags' && tags.length > 0 ? '' : placeholder}
          className={`flex-1 bg-transparent text-[14px] outline-none min-w-[200px] ${
            syntaxError ? 'text-[#FF3B30] placeholder-[#FF3B30]/60' : 'text-[#1C1C1E] dark:text-[#F2F2F7] placeholder-[#8E8E93]'
          }`}
        />

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {(inputValue || tags.length > 0) && (
            <button type="button" onClick={clearAll} className="p-1.5 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] rounded-md text-[#8E8E93] transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleMode}
            className={`p-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              mode === 'advanced'
                ? 'bg-[#E5F0FF] text-[#007AFF] border-[#007AFF]/20 dark:bg-[#007AFF]/20 dark:border-[#007AFF]/30'
                : 'bg-transparent text-[#8E8E93] border-transparent hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>DBQL</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="p-1.5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {syntaxError && (
        <div className="flex items-center gap-1.5 text-[12px] text-[#FF3B30] mt-1 ml-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          {syntaxError}
        </div>
      )}

      {isOpen && suggestions.length > 0 && !syntaxError && (
        <div className="absolute top-12 left-0 right-0 bg-white dark:bg-[#1C1C1E] border border-[#D1D1D6] dark:border-[#38383A] rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="px-4 py-2 text-[11px] font-bold text-[#8E8E93] uppercase bg-[#F9F9F9] dark:bg-[#2C2C2E] border-b border-[#E5E5EA] dark:border-[#38383A]">
            Sugestões para {activeField}
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-4 py-2.5 text-sm text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-[#F2F2F7] dark:hover:bg-[#38383A] transition-colors border-b last:border-b-0 border-[#E5E5EA] dark:border-[#2C2C2E]"
            >
              <span className="font-medium text-[#007AFF] mr-1">{activeField}:</span>
              <span>{item.includes(' ') ? `"${item}"` : item}</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal de Ajuda DBQL */}
      {isHelpModalOpen && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-[#1C1C1E] rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center p-5 border-b border-[#E5E5EA] dark:border-[#38383A]">
                <h3 className="text-xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7]">DBQL - Sintaxe Rápida</h3>
                <button onClick={() => setIsHelpModalOpen(false)} className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div>
                  <h4 className="font-semibold text-[15px] text-[#1C1C1E] dark:text-[#F2F2F7] mb-3 flex items-center gap-2">
                    🔍 Propriedades
                  </h4>
                  <div className="border border-[#E5E5EA] dark:border-[#38383A] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F9F9F9] dark:bg-[#2C2C2E] border-b border-[#E5E5EA] dark:border-[#38383A]">
                        <tr>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-1/4">Propriedade</th>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-2/4">Descrição</th>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-1/4">Exemplo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5EA] dark:divide-[#38383A]">
                        {currentProps.map((p, idx) => (
                          <tr key={idx} className="bg-white dark:bg-[#1C1C1E]">
                            <td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">{p.prop}</td>
                            <td className="p-3 text-[#333333] dark:text-[#D1D1D6]">{p.desc}</td>
                            <td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">{p.ex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[15px] text-[#1C1C1E] dark:text-[#F2F2F7] mb-3 flex items-center gap-2">
                    ⚙️ Operadores e Símbolos
                  </h4>
                  <div className="border border-[#E5E5EA] dark:border-[#38383A] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F9F9F9] dark:bg-[#2C2C2E] border-b border-[#E5E5EA] dark:border-[#38383A]">
                        <tr>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-1/5">Operador</th>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-2/5">Descrição</th>
                          <th className="p-3 text-[#666666] dark:text-[#A1A1A6] font-semibold w-2/5">Exemplo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E5EA] dark:divide-[#38383A]">
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">AND</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">E lógico</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">branch:main AND severity:critical</td></tr>
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">OR</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">OU lógico</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">severity:high OR severity:critical</td></tr>
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">NOT</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">NÃO lógico</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">NOT branch:main</td></tr>
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">!</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">Nega um termo (atalho)</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">!branch:main</td></tr>
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">( )</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">Agrupamento</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">(severity:high OR severity:critical)</td></tr>
                        <tr className="bg-white dark:bg-[#1C1C1E]"><td className="p-3 font-bold text-[#007AFF]">*</td><td className="p-3 text-[#333333] dark:text-[#D1D1D6]">Curinga (Wildcard)</td><td className="p-3 font-mono text-[#333333] dark:text-[#F2F2F7]">fileName:*Controller.cs</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-[#E5E5EA] dark:border-[#38383A] bg-[#F9F9F9] dark:bg-[#2C2C2E] flex flex-col gap-3">
                <p className="text-[13px] text-[#8E8E93]">Para uma documentação completa com exemplos avançados, consulte a Wiki.</p>
                <a
                  href="/wiki/dbql/syntax"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex justify-center items-center bg-[#007AFF] hover:bg-[#0063CE] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm self-start"
                >
                  Abrir Página de Ajuda Completa
                </a>
              </div>
           </div>
         </div>
      )}
    </div>
  );
}