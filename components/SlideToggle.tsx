'use client';

import type { LucideIcon } from "lucide-react";

export interface SlideToggleOption<T extends string = string> {
  key: T;
  label: string;
  icon?: LucideIcon;
  activeClassName?: string;
  inactiveClassName?: string;
}

interface SlideToggleProps<T extends string = string> {
  options: SlideToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function SlideToggle<T extends string = string>({
  options,
  value,
  onChange,
  width = 200,
  height = 35,
  className = '',
}: SlideToggleProps<T>) {
  const parseSize = (size: number | string): number => {
    if (typeof size === 'number') return size;
    return parseFloat(size) || 200;
  };

  const containerWidth = parseSize(width);
  const containerHeight = parseSize(height);
  const padding = 4; // p-1
  const borderWidth = 1; // classe "border" aplica 1px

  // Área útil descontando borda e padding
  const effectivePadding = padding + borderWidth;

  // Largura e altura do knob
  const knobWidth = (containerWidth - 2 * effectivePadding) / options.length;
  const knobHeight = containerHeight - 2 * effectivePadding;

  const activeIndex = options.findIndex(opt => opt.key === value);
  const translateX = activeIndex * knobWidth;

  const knobStyle = {
    width: `${knobWidth}px`,
    height: `${knobHeight}px`,
    transform: `translateX(${translateX}px)`,
  };

  return (
    <div
      className={`relative flex rounded-full border bg-page dark:bg-surface shadow-inner p-1 ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
    >
      <span
        className="absolute top-1 left-1 rounded-full bg-elevated drop-shadow-sm transition-all duration-300"
        style={knobStyle}
      />

      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = opt.key === value;
        const activeClass = opt.activeClassName || 'text-success';
        const inactiveClass = opt.inactiveClassName || 'text-muted';

        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="flex-1 relative z-10 flex items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors"
          >
            {Icon && <Icon className={`w-3 h-3 ${isActive ? activeClass : inactiveClass}`} />}
            <span className={`${isActive ? activeClass : inactiveClass}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}