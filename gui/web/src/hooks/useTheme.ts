import { useCallback, useState } from 'react';
import { loadTheme, saveTheme } from '@/lib/storage';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() =>
    typeof document === 'undefined' ? 'dark' : loadTheme(),
  );

  const setTheme = useCallback((next: 'light' | 'dark') => {
    saveTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
}
