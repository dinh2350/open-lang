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
  /** Switches the page to this mode and saves it as the choice. */
  readonly setMode: (next: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

/** Holds the light or dark mode, themes everything below it, and saves each choice. */
export function ThemeModeProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const setMode = useCallback((next: ThemeMode) => {
    saveMode(next);
    setModeState(next);
  }, []);
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
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
