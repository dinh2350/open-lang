import { Switch } from '@astryxdesign/core/Switch';
import type { ReactElement } from 'react';
import { useThemeMode } from './theme-mode-provider';

/** A switch for dark mode: on while the page is dark, and a toggle saves the choice. */
export function ModeToggle(): ReactElement {
  const { mode, setMode } = useThemeMode();
  return (
    <Switch
      label="Dark mode"
      value={mode === 'dark'}
      onChange={(on) => {
        setMode(on ? 'dark' : 'light');
      }}
    />
  );
}
