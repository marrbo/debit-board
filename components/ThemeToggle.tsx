// components/ThemeToggle.tsx
"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useLocalSetting } from "@/hooks/useLocalSettings";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

// Detecta se estamos no cliente sem causar cascading render.
// No SSR: false. Após hidratação: true. Nunca muda depois.
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const [, setTheme] = useLocalSetting("theme");
  const isDark = useResolvedTheme() === "dark";
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const active = mounted && isDark;

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-6 w-10 rounded-full transition-colors duration-300 focus:outline-none"
      aria-label="Alternar tema"
      role="switch"
      aria-checked={active}
    >
      <span
        className={`absolute inset-0 rounded-full transition-colors duration-300 shadow-inner shadow-black/20 ${
          active ? "bg-gray-700 !shadow-none" : "bg-gray-300"
        }`}
      />
      <span
        className={`absolute flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-black shadow-md transition-transform duration-300 ${
          active ? "translate-x-0" : "-translate-x-3.5"
        }`}
      >
        {active ? (
          <Moon className="w-4 h-4 text-white" />
        ) : (
          <Sun className="w-4 h-4 text-orange-500" />
        )}
      </span>
    </button>
  );
}
