// components/AdvancedSearch.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X, Code2, Tag, HelpCircle } from 'lucide-react';

interface AdvancedSearchProps {
  onSearch?: (queryString: string) => void;
  placeholder?: string;
  context?: 'issues' | 'stats' | 'projects' | 'repositories';
}

const STORAGE_KEY = 'debitboard_global_query';

export default function AdvancedSearch({
  onSearch,
  placeholder = 'Search...',
  context = 'issues'
}: AdvancedSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [mode, setMode] = useState<'tags' | 'advanced'>('tags');
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 CORREÇÃO DAS ASPAS: Tokeniza a string adicionando aspas duplas em valores com espaços
  const parseInputToTags = (input: string): string[] => {
    const parts = input.trim().split(' ');
    const result: string[] = [];
    let i = 0;

    while (i < parts.length) {
      const current = parts[i];
      if (current.includes(':')) {
        let value = current;
        let j = i + 1;
        while (
          j < parts.length &&
          !parts[j].includes(':') &&
          parts[j] !== 'AND' &&
          parts[j] !== 'OR' &&
          parts[j] !== 'NOT'
        ) {
          value += ' ' + parts[j];
          j++;
        }
        // Separa a chave e o valor
        const [key, ...valParts] = value.split(':');
        const finalVal = valParts.join(':').trim();
        
        // Se o valor contém espaço ou aspas já existentes, envolve em aspas duplas
        if (finalVal.includes(' ') && !finalVal.startsWith('"')) {
          result.push(`${key}:"${finalVal}"`);
        } else {
          result.push(`${key}:${finalVal}`);
        }
        i = j;
      } else {
        result.push(current);
        i++;
      }
    }
    return result;
  };

  // Restaura a UI a partir da URL/sessionStorage
  useEffect(() => {
    let query = urlQuery;
    if (!query) {
      const storedQuery = sessionStorage.getItem(STORAGE_KEY);
      if (storedQuery) query = storedQuery;
    }

    if (query && query.trim() !== '') {
      const hasSpecialSyntax = /[\(\)!\*]/.test(query);
      if (hasSpecialSyntax) {
        setMode('advanced');
        setInputValue(query);
        setTags([]);
      } else {
        setMode('tags');
        const newTags = parseInputToTags(query);
        setTags(newTags);
        setInputValue('');
      }
    } else {
      setMode('tags');
      setTags([]);
      setInputValue('');
    }
    setIsOpen(false);
  }, [urlQuery]);

  // Busca as sugestões da API (Modo Tags) com cancelamento
  useEffect(() => {
    if (mode === 'advanced') {
      setIsOpen(false);
      return;
    }

    const fetchSuggestions = async () => {
      const parts = inputValue.split(':');
      if (parts.length === 2 && parts[0].trim() !== '') {
        const fieldKey = parts[0].trim();
        let query = parts[1].trim();

        if (query.includes('*')) {
          setSuggestions([]);
          setIsOpen(false);
          setActiveField(null);
          return;
        }

        setActiveField(fieldKey);
        setIsLoading(true);

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const res = await fetch(
            `/api/issue-filters?field=${fieldKey}&query=${query}&context=${context}`,
            { signal: controller.signal }
          );
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data.suggestions || []);
            if (data.suggestions.length > 0 && inputValue.trim()) {
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          } else {
            setSuggestions([]);
            setIsOpen(false);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Erro ao buscar sugestões:', err);
            setSuggestions([]);
            setIsOpen(false);
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
        setActiveField(null);
        setIsOpen(false);
      }
    };

    const timeout = setTimeout(() => {
      if (inputValue) fetchSuggestions();
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [inputValue, mode, context]);

  const updateAndSearch = (newQuery: string) => {
    if (newQuery) sessionStorage.setItem(STORAGE_KEY, newQuery);
    else sessionStorage.removeItem(STORAGE_KEY);

    const params = new URLSearchParams(searchParams);
    if (newQuery) params.set('q', newQuery);
    else params.delete('q');
    router.replace(`?${params.toString()}`, { scroll: false });

    if (onSearch) onSearch(newQuery);
  };

  const clearAll = () => {
    setTags([]);
    setInputValue('');
    setIsOpen(false);
    updateAndSearch('');
    if (inputRef.current) inputRef.current.focus();
  };

  const toggleMode = () => {
    if (mode === 'tags') {
      const currentQuery = tags.join(' ');
      setMode('advanced');
      setInputValue(currentQuery);
    } else {
      const hasComplexSyntax = /[\(\)!\*]/.test(inputValue);
      if (hasComplexSyntax) {
        alert('Não é possível converter para o modo Tags. O texto atual contém parênteses `()`, negações `!` ou curingas `*`, que são suportados apenas no modo Avançado.');
        return;
      }
      const newTags = parseInputToTags(inputValue);
      setMode('tags');
      setTags(newTags);
      setInputValue('');
      updateAndSearch(newTags.join(' '));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode === 'advanced') {
      if (e.key === 'Enter' && inputValue.trim()) {
        updateAndSearch(inputValue.trim());
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'Enter' && inputValue.trim()) {
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
        return;
      }

      const rawInput = inputValue.trim();
      const newTerms = parseInputToTags(rawInput);

      if (newTerms.length > 0) {
        const updatedTags = [...tags, ...newTerms];
        setTags(updatedTags);
        updateAndSearch(updatedTags.join(' '));
        setInputValue('');
        setIsOpen(false);
        if (inputRef.current) inputRef.current.focus();
      } else {
        setInputValue('');
      }
    } else if (e.key === 'Enter' && !inputValue.trim() && tags.length > 0) {
      updateAndSearch(tags.join(' '));
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      updateAndSearch(newTags.join(' '));
    }
  };

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
    updateAndSearch(newTags.join(' '));
  };

  const handleSelectSuggestion = (suggestion: string) => {
    if (!activeField) return;
    const finalTag = `${activeField}:${suggestion}`;
    const newTags = [...tags, finalTag];
    setTags(newTags);
    updateAndSearch(newTags.join(' '));
    setInputValue('');
    setSuggestions([]);
    setActiveField(null);
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <div className="relative w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-[#D1D1D6] dark:border-[#38383A] rounded-2xl px-4 py-3 flex flex-col gap-2 focus-within:border-transparent focus-within:ring-2 focus-within:ring-[#007AFF]/30 transition-all shadow-sm">
      
      {/* 🍎 LINHA DAS TAGS (Acima do Input) */}
      {mode === 'tags' && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 w-full pb-1 border-b border-[#D1D1D6]/30 dark:border-[#38383A]/30">
          {tags.map((tag, index) => (
            <span key={index} className="bg-[#E5E5EA] dark:bg-[#38383A] text-[#1C1C1E] dark:text-[#F5F5F7] px-2 py-0.5 rounded-full text-xs flex items-center gap-1.5 font-medium transition-colors">
              {tag}
              <button onClick={() => removeTag(index)} className="hover:text-[#FF453A] dark:hover:text-[#FF453A] transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 🍎 LINHA DO INPUT (Abaixo das Tags) */}
      <div className="flex items-center gap-2 w-full">
        <Search className="w-4 h-4 text-[#8E8E93] shrink-0" />

        <div className="flex-1 flex items-center min-w-[100px]">
          <input
            ref={inputRef}
            type="text"
            value={mode === 'advanced' ? inputValue : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'tags' && tags.length > 0 ? '' : placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-[#1C1C1E] dark:text-[#F5F5F7] min-w-[50px] placeholder:text-[#8E8E93] dark:placeholder:text-[#636366]"
          />

          <button
            onClick={toggleMode}
            className="ml-1 p-1.5 rounded-full text-[#8E8E93] dark:text-[#8E8E93] hover:bg-[#F2F2F7] dark:hover:bg-[#38383A] transition-colors shrink-0"
            title={mode === 'tags' ? 'Alternar para modo Avançado' : 'Voltar para modo Tags'}
          >
            {mode === 'tags' ? <Code2 className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="ml-1 p-1.5 rounded-full text-[#8E8E93] dark:text-[#8E8E93] hover:bg-[#F2F2F7] dark:hover:bg-[#38383A] transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {(tags.length > 0 || inputValue) && (
            <button
              onClick={clearAll}
              className="ml-1 p-1.5 rounded-full text-[#8E8E93] dark:text-[#8E8E93] hover:bg-[#F2F2F7] dark:hover:bg-[#38383A] transition-colors shrink-0 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sugestões */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-2 w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-[#D1D1D6] dark:border-[#38383A] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-50 py-2 overflow-hidden transition-all">
          <div className="px-4 py-1.5 text-[9px] uppercase text-[#8E8E93] dark:text-[#636366] font-semibold border-b border-[#D1D1D6] dark:border-[#38383A] mb-1">
            Sugestões para {activeField}
          </div>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelectSuggestion(s)}
              className="w-full text-left px-4 py-2 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors flex justify-between items-center"
            >
              <span className="text-[#007AFF] text-sm font-mono">{s}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-[#D1D1D6] dark:border-[#38383A] rounded-2xl shadow-xl z-50 px-4 py-3 text-[#8E8E93] dark:text-[#636366] text-sm">
          Carregando sugestões...
        </div>
      )}

      {/* Modal de Ajuda Rápida (Mantido) */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-[#D1D1D6] dark:border-[#38383A] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_16px_48px_rgba(0,0,0,0.16)] overflow-hidden transition-colors">
            <div className="p-5 border-b border-[#D1D1D6] dark:border-[#38383A] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1C1C1E] dark:text-[#F5F5F7]">DBQL - Sintaxe Rápida</h3>
              <button onClick={() => setIsHelpModalOpen(false)} className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F5F5F7] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-[#1C1C1E] dark:text-[#F5F5F7]">
              <h4 className="font-semibold mb-2">🔍 Propriedades</h4>
              <table className="w-full text-xs border-collapse border border-[#D1D1D6] dark:border-[#38383A] mb-4 rounded-lg overflow-hidden transition-colors">
                <thead className="bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#8E8E93] dark:text-[#636366]">
                  <tr><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Propriedade</th><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Descrição</th><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Exemplo</th></tr>
                </thead>
                <tbody className="text-[#1C1C1E] dark:text-[#F5F5F7] bg-[#FFFFFF] dark:bg-[#1C1C1E]">
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">category</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Categoria da vulnerabilidade</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">category:"Broken Access Control"</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">severity</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Severidade (critical, high, medium, low)</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">severity:critical</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">branch</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Branch do repositório</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">branch:main</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">project</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Nome do projeto</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">project:GEPIN_AS</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">repository</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Repositório</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">repository:repo-name</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">status</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Status da issue (open, fixed, etc.)</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">status:open</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">is</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Estado especial</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">is:unresolved</td></tr>
                </tbody>
              </table>

              <h4 className="font-semibold mb-2">⚙️ Operadores e Símbolos</h4>
              <table className="w-full text-xs border-collapse border border-[#D1D1D6] dark:border-[#38383A] rounded-lg overflow-hidden transition-colors">
                <thead className="bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#8E8E93] dark:text-[#636366]">
                  <tr><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Operador</th><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Descrição</th><th className="border border-[#D1D1D6] dark:border-[#38383A] p-2 text-left">Exemplo</th></tr>
                </thead>
                <tbody className="text-[#1C1C1E] dark:text-[#F5F5F7] bg-[#FFFFFF] dark:bg-[#1C1C1E]">
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">AND</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">E lógico</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">branch:main AND severity:critical</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">OR</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">OU lógico</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">severity:high OR severity:critical</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">NOT</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">NÃO lógico</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">NOT branch:main</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">!</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Nega um termo (atalho)</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">!branch:main</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">( )</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Agrupamento</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">(severity:high OR severity:critical)</td></tr>
                  <tr><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-bold text-[#007AFF]">*</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2">Curinga (Wildcard)</td><td className="border border-[#D1D1D6] dark:border-[#38383A] p-2 font-mono">fileName:*Controller.cs</td></tr>
                </tbody>
              </table>
              <div className="mt-4 pt-4 border-t border-[#D1D1D6] dark:border-[#38383A]">
                <p className="text-xs text-[#8E8E93] dark:text-[#636366] mb-3">Para uma documentação completa com exemplos avançados, consulte a Wiki.</p>
                <a
                  href="/wiki/dbql/syntax"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#007AFF] hover:bg-[#0063CE] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                  Abrir Página de Ajuda Completa
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}