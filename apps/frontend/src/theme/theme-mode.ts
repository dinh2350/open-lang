export type ThemeMode = 'light' | 'dark';

export const THEME_MODE_STORAGE_KEY = 'open-lang-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/** The mode the user chose last time, or null when none is saved or storage is unavailable. */
export function readSavedMode(): ThemeMode | null {
  try {
    const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remembers the user's choice; the page keeps working when storage is unavailable. */
export function saveMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Private mode or a full disk: the choice lasts until the page closes.
  }
}

/** The mode the device prefers; light when the browser cannot tell. */
export function deviceMode(): ThemeMode {
  const prefersDark =
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/** The saved choice, else the device's. */
export function initialMode(): ThemeMode {
  return readSavedMode() ?? deviceMode();
}
