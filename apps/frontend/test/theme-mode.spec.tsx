import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeModeProvider, useThemeMode } from '@/theme/theme-mode-provider';
import {
  THEME_MODE_STORAGE_KEY,
  deviceMode,
  initialMode,
  readSavedMode,
  saveMode,
} from '@/theme/theme-mode';
import { deviceUses } from './device-mode';

// Only this file spies on Storage; restoring every mock in setup.ts would also
// undo the Room spies the other specs rely on.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('theme mode functions', () => {
  it('readSavedMode returns null when nothing is saved', () => {
    expect(readSavedMode()).toBeNull();
  });

  it('readSavedMode returns the saved mode', () => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');
    expect(readSavedMode()).toBe('dark');
  });

  it('readSavedMode ignores a saved value that is not light or dark', () => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'purple');
    expect(readSavedMode()).toBeNull();
  });

  it('readSavedMode returns null when reading storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readSavedMode()).toBeNull();
  });

  it('saveMode does not throw when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => {
      saveMode('dark');
    }).not.toThrow();
  });

  it('deviceMode is dark when the device prefers dark', () => {
    deviceUses('dark');
    expect(deviceMode()).toBe('dark');
  });

  it('deviceMode is light when the device prefers light', () => {
    deviceUses('light');
    expect(deviceMode()).toBe('light');
  });

  it('deviceMode is light when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(deviceMode()).toBe('light');
  });

  it('initialMode lets a saved choice win over the device', () => {
    deviceUses('dark');
    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    expect(initialMode()).toBe('light');
  });
});

function Consumer() {
  const { mode, toggleMode } = useThemeMode();
  return (
    <button type="button" onClick={toggleMode}>
      toggle ({mode})
    </button>
  );
}

function renderWithProvider(): void {
  render(
    <ThemeModeProvider>
      <Consumer />
    </ThemeModeProvider>,
  );
}

describe('ThemeModeProvider', () => {
  it('toggleMode flips the mode, puts it on the page root and saves it', async () => {
    deviceUses('light');
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: /toggle/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
  });

  it('toggleMode still switches the page when storage throws', async () => {
    deviceUses('light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    renderWithProvider();
    await userEvent.click(screen.getByRole('button', { name: /toggle/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('useThemeMode throws outside a ThemeModeProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Consumer />)).toThrow(
      'useThemeMode needs a ThemeModeProvider',
    );
  });
});
