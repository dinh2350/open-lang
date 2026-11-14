import type { AuthResponse, User } from '@livekit-platform/shared';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

/** `fetch` for backend endpoints that need a signed-in User. */
export type AuthorizedFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface Auth {
  /** The signed-in User, or `null` when nobody is signed in. */
  readonly user: User | null;
  /** Signs in the User of a register or sign-in response. */
  readonly signIn: (response: AuthResponse) => void;
  /** Sends the signed-in User's Auth Token with the request. */
  readonly authorizedFetch: AuthorizedFetch;
}

/**
 * Outside an AuthProvider, as in the Conversation page's own tests, nobody
 * is signed in and requests go without an Auth Token.
 */
const signedOut: Auth = {
  user: null,
  signIn: () => {
    throw new Error('Signing in needs an AuthProvider');
  },
  authorizedFetch: (input, init) => fetch(input, init),
};

const AuthContext = createContext<Auth>(signedOut);

/**
 * Keeps the signed-in User and their Auth Token in memory only, so a reload
 * signs the User out.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // A ref, so that a request made later, such as a Room Token request,
  // always sends the latest Auth Token.
  const authToken = useRef<string | null>(null);

  const signIn = useCallback((response: AuthResponse) => {
    authToken.current = response.authToken;
    setUser(response.user);
  }, []);

  const authorizedFetch = useCallback<AuthorizedFetch>((input, init) => {
    const headers = new Headers(init?.headers);
    if (authToken.current !== null) {
      headers.set('Authorization', `Bearer ${authToken.current}`);
    }
    return fetch(input, { ...init, headers });
  }, []);

  const auth = useMemo(
    () => ({ user, signIn, authorizedFetch }),
    [user, signIn, authorizedFetch],
  );
  return <AuthContext value={auth}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  return use(AuthContext);
}
