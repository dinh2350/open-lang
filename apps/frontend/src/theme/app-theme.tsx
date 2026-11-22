import { LinkProvider } from '@astryxdesign/core/Link';
import { Theme } from '@astryxdesign/core/theme';
import { stoneTheme } from '@astryxdesign/theme-stone/built';
import type { ReactElement, ReactNode } from 'react';
import { RouterLink } from './router-link';
import type { ThemeMode } from './theme-mode';

export function AppTheme({
  mode,
  children,
}: {
  readonly mode: ThemeMode;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Theme theme={stoneTheme} mode={mode}>
      <LinkProvider component={RouterLink}>{children}</LinkProvider>
    </Theme>
  );
}
