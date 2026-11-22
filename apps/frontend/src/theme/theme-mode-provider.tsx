import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { AppTheme } from './app-theme';
import { initialMode, saveMode, type ThemeMode } from './theme-mode';

interface ThemeModeValue {
  readonly mode: ThemeMode;
  readonly toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/** Holds the light or dark mode, themes everything below it, and saves each toggle. */
export function ThemeModeProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const toggleMode = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    saveMode(next);
    setMode(next);
  }, [mode]);
  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);
  return (
    <ThemeModeContext.Provider value={value}>
      <AppTheme mode={mode}>{children}</AppTheme>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeValue {
  const value = useContext(ThemeModeContext);
  if (value === null) {
    throw new Error('useThemeMode needs a ThemeModeProvider');
  }
  return value;
}
