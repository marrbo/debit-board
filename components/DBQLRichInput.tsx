// components/DBQLRichInput.tsx
import React, { useRef, useEffect } from 'react';

interface DBQLRichInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export default function DBQLRichInput({ value, onChange, placeholder, className = '', rows = 3 }: DBQLRichInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 48)}px`;
    }
  }, [value]);

  const renderDBQLColoredQuery = (text: string) => {
    if (!text) return null;
    const regex = /("[^"]*"|!?\b[a-zA-Z0-9_]+:"[^"]*"|!?\b[a-zA-Z0-9_]+:[^\s\(\)]+|\b(?:and|or|not)\b|[\(\)]|\s+|[^\s]+)/gi;
    const parts = text.match(regex) || [text];

    return parts.map((part, i) => {
      const lower = part.toLowerCase();
      if (['and', 'or', 'not'].includes(lower)) return <span key={i} className="text-purple-600 dark:text-purple-400 font-bold">{part}</span>;
      if (part === '(' || part === ')') return <span key={i} className="text-pink-600 dark:text-pink-400 font-bold">{part}</span>;
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
      if (/^["'].*?["']$/.test(part)) return <span key={i} className="text-amber-600 dark:text-amber-400">{part}</span>;
      if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
      return <span key={i} className="text-apple-label-light dark:text-apple-label-dark">{part}</span>;
    });
  };

  return (
    <div className={`relative grid grid-cols-1 items-stretch w-full bg-apple-border-light/20 dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl focus-within:border-apple-blue overflow-hidden ${className}`}>
      <div className="col-start-1 row-start-1 text-[13px] font-mono pointer-events-none whitespace-pre-wrap break-words leading-relaxed p-3 select-none w-full h-full">
        {renderDBQLColoredQuery(value)}
      </div>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="col-start-1 row-start-1 w-full h-full bg-transparent text-[13px] font-mono outline-none ring-0 border-none shadow-none p-3 text-transparent caret-apple-label-light dark:caret-white resize-none overflow-hidden leading-relaxed whitespace-pre-wrap break-words"
      />
    </div>
  );
}