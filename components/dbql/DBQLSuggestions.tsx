'use client';

import { useEffect, useRef } from 'react';

interface DBQLSuggestionsProps {
  isOpen: boolean;
  suggestions: string[];
  activeField: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function DBQLSuggestions({
  isOpen,
  suggestions,
  activeField,
  onSelect,
  onClose
}: DBQLSuggestionsProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o popup ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1 w-full sm:w-auto min-w-[250px] max-w-full bg-white dark:bg-[#2C2C2E] border border-default dark:border-strong rounded-xl shadow-sm hover:drop-shadow-lg z-50 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-default dark:border-strong bg-apple-border-light/10 dark:bg-black/10">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
          Sugestões para: <span className="text-brand lowercase">{activeField}</span>
        </span>
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {suggestions.map((suggestion, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => onSelect(suggestion)}
              className="w-full text-left px-3 py-2 text-xs text-heading dark:text-heading hover:bg-brand/10 hover:text-brand transition-colors truncate"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}