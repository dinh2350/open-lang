import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Room } from 'livekit-client';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { AdminNav } from './admin/admin-nav';
import { RequireAdmin } from './admin/require-admin';
import { UsersPage } from './admin/users-page';
import { AuthProvider } from './auth/auth-context';
import { RegisterPage } from './auth/register-page';
import { RequireSignedIn } from './auth/require-signed-in';
import { SignedInHeader } from './auth/signed-in-header';
import { SignInPage } from './auth/sign-in-page';
import { ConversationPage } from './conversation/conversation-page';

interface AppProps {
  /** The LiveKit Room the Conversation page connects through. */
  readonly room: Room;
  /** How long a Conversation waits for the Agent to join. */
  readonly agentJoinTimeoutMilliseconds: number;
}

/** Every page of the app, inside the router that `main.tsx` or a test provides. */
export function App({ room, agentJoinTimeoutMilliseconds }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SignedInHeader>
          <AdminNav />
        </SignedInHeader>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireSignedIn />}>
            <Route
              path="/"
              element={
                <ConversationPage
                  room={room}
                  agentJoinTimeoutMilliseconds={agentJoinTimeoutMilliseconds}
                />
              }
            />
            <Route element={<RequireAdmin />}>
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}
