// components/ThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const storedTheme = localStorage.getItem('wiki-theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('wiki-theme', 'dark');
      setTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('wiki-theme', 'light');
      setTheme('light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[9px] font-medium transition-colors w-full text-apple-tertiary-light dark:text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-apple-label-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]"
      aria-label="Alternar tema"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 mb-1 text-apple-tertiary-light dark:text-apple-tertiary-light" />
      ) : (
        <Sun className="w-5 h-5 mb-1 text-[#FFD60A]" />
      )}
      <span className="text-center leading-tight">Theme</span>
    </button>
  );
}