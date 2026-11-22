import type { AuthResponse, User } from '@open-lang/shared';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  accountLockedMessageOf,
  refresh as requestRefresh,
  signOut as requestSignOut,
} from './auth-api';

const UNAUTHORIZED = 401;

/**
 * `fetch` for backend endpoints that need a signed-in User. A request the
 * backend answers with `401` is sent once more after a refresh, so its body
 * must be one `fetch` can send twice, such as a string.
 */
export type AuthorizedFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface Auth {
  /** The signed-in User, or `null` when nobody is signed in. */
  readonly user: User | null;
  /**
   * True on page load, until the app knows whether the browser's refresh
   * cookie still signs a User in.
   */
  readonly restoringSignIn: boolean;
  /**
   * The account locked message, when the backend signed the User out
   * because an Admin locked them. Cleared when someone signs in.
   */
  readonly accountLockedMessage: string | null;
  /** Signs in the User of a register or sign-in response. */
  readonly signIn: (response: AuthResponse) => void;
  /**
   * Revokes the User's refresh cookie on the backend, then forgets the
   * User. Rejects, and keeps the User signed in, when the backend fails.
   */
  readonly signOut: () => Promise<void>;
  /**
   * Sends the signed-in User's Auth Token with the request. When the
   * backend answers that the User is locked, it forgets the User, which
   * sends them to sign-in with the account locked message.
   */
  readonly authorizedFetch: AuthorizedFetch;
}

/**
 * Outside an AuthProvider, as in the Conversation page's own tests, nobody
 * is signed in and requests go without an Auth Token.
 */
const signedOut: Auth = {
  user: null,
  restoringSignIn: false,
  accountLockedMessage: null,
  signIn: () => {
    throw new Error('Signing in needs an AuthProvider');
  },
  signOut: () => Promise.resolve(),
  authorizedFetch: (input, init) => fetch(input, init),
};

const AuthContext = createContext<Auth>(signedOut);

/**
 * Keeps the signed-in User and their Auth Token in memory only. On page
 * load it asks the backend for a new Auth Token with the refresh cookie, so
 * a User stays signed in across reloads.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoringSignIn, setRestoringSignIn] = useState(true);
  const [accountLockedMessage, setAccountLockedMessage] = useState<
    string | null
  >(null);
  // A ref, so that a request made later, such as a Room Token request,
  // always sends the latest Auth Token.
  const authToken = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const signIn = useCallback((response: AuthResponse) => {
    authToken.current = response.authToken;
    setAccountLockedMessage(null);
    setUser(response.user);
  }, []);

  const forgetUser = useCallback(() => {
    authToken.current = null;
    setUser(null);
  }, []);

  /**
   * Swaps the refresh cookie for a new Auth Token, and resolves to whether
   * a User is signed in afterwards. When the cookie no longer works, it
   * forgets the User, so their pages send them to sign-in.
   *
   * Every refresh rotates the cookie, and the backend treats a rotated
   * cookie sent again as stolen, so callers that ask at the same time
   * share one request.
   */
  const refresh = useCallback(() => {
    refreshInFlight.current ??= requestRefresh()
      .then((response) => {
        if (response === null) {
          forgetUser();
          return false;
        }
        signIn(response);
        return true;
      })
      .finally(() => {
        refreshInFlight.current = null;
      });
    return refreshInFlight.current;
  }, [signIn, forgetUser]);

  const signOut = useCallback(async () => {
    await requestSignOut();
    forgetUser();
  }, [forgetUser]);

  useEffect(() => {
    void refresh().finally(() => {
      setRestoringSignIn(false);
    });
  }, [refresh]);

  const authorizedFetch = useCallback<AuthorizedFetch>(
    async (input, init) => {
      const send = () => {
        const headers = new Headers(init?.headers);
        if (authToken.current !== null) {
          headers.set('Authorization', `Bearer ${authToken.current}`);
        }
        return fetch(input, { ...init, headers });
      };
      let response = await send();
      // The Auth Token has expired: get a new one, and try once more.
      if (response.status === UNAUTHORIZED && (await refresh())) {
        response = await send();
      }
      const lockedMessage = await accountLockedMessageOf(response);
      if (lockedMessage !== null) {
        setAccountLockedMessage(lockedMessage);
        forgetUser();
      }
      return response;
    },
    [refresh, forgetUser],
  );

  const auth = useMemo(
    () => ({
      user,
      restoringSignIn,
      accountLockedMessage,
      signIn,
      signOut,
      authorizedFetch,
    }),
    [
      user,
      restoringSignIn,
      accountLockedMessage,
      signIn,
      signOut,
      authorizedFetch,
    ],
  );
  return <AuthContext value={auth}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  return use(AuthContext);
}
