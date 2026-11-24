'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'Auto' | 'Light' | 'Dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'Auto';
  const saved = localStorage.getItem('subham_mes_theme') as Theme | null;
  if (saved && ['Auto', 'Light', 'Dark'].includes(saved)) return saved;
  return 'Auto';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('Auto');
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      let r: 'light' | 'dark';
      if (theme === 'Light') r = 'light';
      else if (theme === 'Dark') r = 'dark';
      else {
        r = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      setResolved(r);
      const root = document.documentElement;
      root.setAttribute('data-theme', r);
      root.classList.toggle('dark', r === 'dark');
      root.classList.toggle('light', r === 'light');
      localStorage.setItem('subham_mes_theme', theme);
    };
    apply();
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => theme === 'Auto' && apply();
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}