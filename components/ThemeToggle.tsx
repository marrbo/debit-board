'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useColorScheme } from '@mui/material/styles';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { setMode } = useColorScheme();
  
  const isDark = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener('theme-change', onStoreChange);

      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener('theme-change', onStoreChange);
      };
    },
    () =>
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('wiki-theme') === 'dark',
    () => false,
  );

  const activeDark = isDark;

  // 🔹 CORREÇÃO DO LOAD: Quando a página carrega, sincroniza o Tailwind 
  // imediatamente com o estado lido do storage/DOM
  useEffect(() => {
    if (activeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [activeDark]);

  const toggleTheme = () => {
    const nextTheme = activeDark ? 'light' : 'dark';
    
    // 1. Atualiza o Material UI
    setMode(nextTheme);
    
    // 2. Atualiza o Tailwind CSS
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('wiki-theme', nextTheme);
    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors duration-300 focus:outline-none"
      aria-label="Alternar tema"
      role="switch"
      aria-checked={activeDark}
    >
      <span 
        className={`absolute inset-0 rounded-full transition-colors duration-300 ${
          activeDark ? 'bg-gray-700' : 'bg-gray-500'
        }`} 
      />
      <span 
        className={`absolute flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-black shadow-md transition-transform duration-300 ${
          activeDark ? 'translate-x-4' : '-translate-x-0.5'
        }`}
      >
        {activeDark ? (
          <Moon className="w-4 h-4 text-white" />
        ) : (
          <Sun className="w-4 h-4 text-orange-500" />
        )}
      </span>
    </button>
  );
}
