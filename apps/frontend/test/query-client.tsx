import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

/** `ui` with a QueryClient of its own, as the App gives its pages one. */
export function withQueryClient(ui: ReactElement): ReactElement {
  return (
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  );
}
