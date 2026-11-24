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
 * Makes the window as narrow as a phone's, in light mode: no `min-width`
 * query matches.
 */
export function deviceIsAPhone(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}
