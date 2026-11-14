import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Room } from 'livekit-client';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { AuthProvider } from './auth/auth-context';
import { RegisterPage } from './auth/register-page';
import { RequireSignedIn } from './auth/require-signed-in';
import { SignInPage } from './auth/sign-in-page';
import { ConversationPage } from './conversation/conversation-page';

interface AppProps {
  /** The LiveKit Room the Conversation page connects through. */
  readonly room: Room;
}

/** Every page of the app, inside the router that `main.tsx` or a test provides. */
export function App({ room }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireSignedIn />}>
            <Route path="/" element={<ConversationPage room={room} />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}
