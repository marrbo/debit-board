"use client";

import { useState, useEffect } from "react";
import { Search, X, Info } from "lucide-react";

export interface SimpleColumnSearchProps {
  columns: {
    key: string | number | symbol;
    label: string;
    sortable?: boolean;
  }[];
  onSearch: (column: string | null, value: string) => void;
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
}

export function SimpleColumnSearch({
  columns,
  onSearch,
  placeholder = "Filtrar por...",
  minLength = 2,
  debounceMs = 300,
}: SimpleColumnSearchProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>("all");
  const [inputValue, setInputValue] = useState("");

  // 🔥 Mostra aviso sempre que o valor tem menos que minLength (e não está vazio)
  const showHint = inputValue.length > 0 && inputValue.length < minLength;

  useEffect(() => {
    // Se o campo for limpo, chama onSearch imediatamente para limpar filtros
    if (inputValue.length === 0) {
      onSearch(selectedColumn === "all" ? null : selectedColumn, "");
      return;
    }

    // Se tiver menos que minLength, não chama onSearch ainda (apenas mostra hint)
    if (inputValue.length < minLength) {
      return;
    }

    // Debounce para chamar onSearch após o usuário parar de digitar
    const timer = setTimeout(() => {
      onSearch(selectedColumn === "all" ? null : selectedColumn, inputValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [selectedColumn, inputValue, onSearch, minLength, debounceMs]);

  const handleClear = () => {
    setInputValue("");
    setSelectedColumn("all");
    onSearch(null, "");
  };

  return (
    <div className="flex items-center group gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 group-hover:text-brand -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-white dark:bg-surface border border-default dark:border-strong text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-error transition-colors"
          >
            <X className="w-4 h-4 hover:text-error" />
          </button>
        )}

        {/* 🔥 Hint corretamente posicionado dentro do container com relative */}
        {showHint && (
          <div className="absolute left-2 top-full mt-1 text-xs text-muted dark:text-muted flex items-center gap-1">
            <Info className="w-3 h-3 text-warning" />
            Digite pelo menos {minLength} caracteres
          </div>
        )}
      </div>

      <select
        value={selectedColumn}
        onChange={(e) => setSelectedColumn(e.target.value)}
        className="px-3 py-2.5 rounded-lg bg-white dark:bg-surface border border-default dark:border-strong text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <option value="all">Todas as colunas</option>
        {columns
          .filter((col) => col.sortable !== false)
          .map((col) => (
            <option key={String(col.key)} value={String(col.key)}>
              {col.label}
            </option>
          ))}
      </select>
    </div>
  );
}
