'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-changing');
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  // Update foregrounds and backgrounds together, including controls with hover transitions.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-changing')));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>('dark');

  useEffect(() => {
    updateTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = event.newValue === 'light' ? 'light' : 'dark';
      applyTheme(nextTheme);
      updateTheme(nextTheme);
    };
    window.addEventListener('storage', syncStoredTheme);
    return () => window.removeEventListener('storage', syncStoredTheme);
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme);
    updateTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Private browsing or blocked storage still allows switching for this visit.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
