import { vi } from 'vitest';
import type { ThemeMode } from '@/theme/theme-mode';

/**
 * Makes `window.matchMedia('(prefers-color-scheme: dark)')` answer as a device set to `mode`.
 * Every answer can be listened to, as Astryx's controls do for the pointer query.
 */
export function deviceUses(mode: ThemeMode): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && mode === 'dark',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/**
 * Makes the window `width` pixels wide, in light mode, so `min-width`
 * queries answer for that width. `resize` changes the width and tells every
 * query's listeners, as a browser does when a phone turns.
 */
export function deviceHasWidth(width: number): { resize(to: number): void } {
  let currentWidth = width;
  const listeners = new Set<() => void>();
  const matches = (query: string) => {
    const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query)?.[1];
    return minWidth !== undefined && currentWidth >= Number(minWidth);
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches(query);
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));
  return {
    resize(to: number): void {
      currentWidth = to;
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}
