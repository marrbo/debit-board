"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

// Interface genérica para colunas aceitas pelo componente
export interface SimpleColumnSearchProps {
  // Aceita qualquer objeto que tenha pelo menos 'key' e 'label',
  // e opcionalmente 'sortable' (ignorando propriedades extras)
  columns: {
    key: string | number | symbol;
    label: string;
    sortable?: boolean;
  }[];
  onSearch: (column: string | null, value: string) => void;
  placeholder?: string;
}

export function SimpleColumnSearch({
  columns,
  onSearch,
  placeholder = "Filtrar por...",
}: SimpleColumnSearchProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>("all");
  const [inputValue, setInputValue] = useState("");

  // Atualiza o callback quando qualquer campo muda
  useEffect(() => {
    onSearch(selectedColumn === "all" ? null : selectedColumn, inputValue);
  }, [selectedColumn, inputValue, onSearch]);

  const handleClear = () => {
    setInputValue("");
    setSelectedColumn("all");
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-tertiary-light" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-apple-tertiary-light hover:text-apple-red transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <select
        value={selectedColumn}
        onChange={(e) => setSelectedColumn(e.target.value)}
        className="px-3 py-2 rounded-xl bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue"
      >
        <option value="all">Todas as colunas</option>
        {columns
          .filter((col) => col.sortable !== false) // apenas colunas com dados reais
          .map((col) => (
            <option key={String(col.key)} value={String(col.key)}>
              {col.label}
            </option>
          ))}
      </select>
    </div>
  );
}