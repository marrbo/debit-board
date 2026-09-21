"use client";

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
  className = "",
}: SlideToggleProps<T>) {
  const parseSize = (size: number | string): number => {
    if (typeof size === "number") return size;
    return parseFloat(size) || 200;
  };

  const containerWidth = parseSize(width);
  const containerHeight = parseSize(height);

  // 🔑 Border 1px + padding interno de 4px
  const BORDER = 1;
  const PADDING = 4;
  const offset = BORDER + PADDING; // 5px total em cada lado

  const innerWidth = containerWidth - 2 * offset;
  const innerHeight = containerHeight - 2 * offset;
  const knobWidth = innerWidth / options.length;

  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.key === value),
  );
  const translateX = activeIndex * knobWidth;

  return (
    <div
      className={`relative flex font-mono rounded-full border bg-page dark:bg-surface shadow-inner ${className}`}
      style={{
        width: containerWidth,
        height: containerHeight,
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {/* Knob deslizante */}
      <span
        className="absolute rounded-full bg-sunken drop-shadow-sm transition-transform duration-300 ease-out pointer-events-none"
        style={{
          width: `${knobWidth}px`,
          height: `${innerHeight}px`,
          top: `${PADDING}px`,
          left: `${PADDING}px`,
          transform: `translateX(${translateX}px)`,
        }}
      />

      {/* Botões */}
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = opt.key === value;
        const activeClass = opt.activeClassName || "text-success";
        const inactiveClass = opt.inactiveClassName || "text-muted";

        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="relative z-10 flex items-center justify-center gap-1 text-[11px] transition-colors"
            style={{
              width: `${knobWidth}px`,
              height: `${innerHeight}px`,
            }}
          >
            {Icon && (
              <Icon
                className={`w-3 h-3 shrink-0 ${
                  isActive ? activeClass : inactiveClass
                }`}
              />
            )}
            <span
              className={` ${
                isActive
                  ? `${activeClass} font-mono font-semibold`
                  : inactiveClass
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
