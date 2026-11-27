import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ThemeModeProvider } from '@/theme/theme-mode-provider';

/**
 * `ui` with a QueryClient of its own and the light or dark mode, as the App
 * gives its pages both (the tutor's Aura reads the mode).
 */
export function withQueryClient(ui: ReactElement): ReactElement {
  return (
    <ThemeModeProvider>
      <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
    </ThemeModeProvider>
  );
}
