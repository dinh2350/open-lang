import {
  registerRequestSchema,
  signInRequestSchema,
  type User,
} from '@livekit-platform/shared';
import { http, HttpResponse } from 'msw';

const AUTH_TOKEN_LIFETIME_MILLISECONDS = 15 * 60_000;
const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60_000;

interface Account {
  readonly user: User;
  readonly password: string;
}

interface RefreshToken {
  readonly email: string;
  readonly expiresAt: number;
  revoked: boolean;
  rotated: boolean;
}

const accounts = new Map<string, Account>();
const issuedAuthTokens: string[] = [];
const authTokenExpiries = new Map<string, number>();
const refreshTokens = new Map<string, RefreshToken>();
const authRequests: string[] = [];
let refreshes = 0;

/**
 * The refresh cookie the browser holds. The fetch that jsdom tests use
 * keeps no cookies, so the fake backend keeps the browser's cookie too.
 */
let refreshCookie: string | null = null;

/** The backend already has this User, as if they had registered earlier. */
export function backendHasUser(email: string, password: string): User {
  const user: User = {
    id: `user-${String(accounts.size + 1)}`,
    email,
    role: 'member',
  };
  accounts.set(email, { user, password });
  return user;
}

function issueRefreshCookie(email: string): void {
  refreshCookie = `refresh-token-${String(refreshTokens.size + 1)}`;
  refreshTokens.set(refreshCookie, {
    email,
    expiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS,
    revoked: false,
    rotated: false,
  });
}

/**
 * The User signed in in this browser earlier, so the browser holds their
 * refresh cookie.
 */
export function browserIsSignedInAs(email: string, password: string): User {
  const user = backendHasUser(email, password);
  issueRefreshCookie(email);
  return user;
}

/** The emails of every User the backend has, in the order they registered. */
export function registeredEmails(): readonly string[] {
  return [...accounts.keys()];
}

/** The Auth Tokens the backend issued in the current test, oldest first. */
export function authTokensIssued(): readonly string[] {
  return issuedAuthTokens;
}

/** The paths of the register and sign-in requests the backend received. */
export function authRequestsReceived(): readonly string[] {
  return authRequests;
}

/** How many refresh requests the backend received. */
export function refreshesRequested(): number {
  return refreshes;
}

/**
 * Whether an `Authorization` header holds an Auth Token this backend issued
 * less than 15 minutes ago.
 */
export function holdsValidAuthToken(authorization: string): boolean {
  const authToken = /^Bearer (\S+)$/.exec(authorization)?.[1] ?? '';
  return (authTokenExpiries.get(authToken) ?? 0) > Date.now();
}

export function resetAuthBackend(): void {
  accounts.clear();
  issuedAuthTokens.length = 0;
  authTokenExpiries.clear();
  refreshTokens.clear();
  authRequests.length = 0;
  refreshes = 0;
  refreshCookie = null;
}

/** Issues an Auth Token and sets a new refresh cookie. */
function signedIn(user: User, status: number) {
  const authToken = `auth-token-${String(issuedAuthTokens.length + 1)}`;
  issuedAuthTokens.push(authToken);
  authTokenExpiries.set(
    authToken,
    Date.now() + AUTH_TOKEN_LIFETIME_MILLISECONDS,
  );
  issueRefreshCookie(user.email);
  return HttpResponse.json({ authToken, user }, { status });
}

function errorResponse(status: number, message: string) {
  return HttpResponse.json({ statusCode: status, message }, { status });
}

function revokeEveryRefreshTokenOf(email: string): void {
  for (const refreshToken of refreshTokens.values()) {
    if (refreshToken.email === email) {
      refreshToken.revoked = true;
    }
  }
}

/** The backend's auth endpoints, with its rules for each. */
export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    authRequests.push('/api/auth/register');
    const { email, password } = registerRequestSchema.parse(
      await request.json(),
    );
    if (accounts.has(email)) {
      return errorResponse(409, 'An account with this email already exists.');
    }
    return signedIn(backendHasUser(email, password), 201);
  }),
  http.post('/api/auth/sign-in', async ({ request }) => {
    authRequests.push('/api/auth/sign-in');
    const { email, password } = signInRequestSchema.parse(await request.json());
    const account = accounts.get(email);
    if (account?.password !== password) {
      return errorResponse(401, 'Wrong email or password.');
    }
    return signedIn(account.user, 200);
  }),
  http.post('/api/auth/refresh', () => {
    refreshes += 1;
    const current =
      refreshCookie === null ? undefined : refreshTokens.get(refreshCookie);
    if (current?.rotated === true) {
      // Used twice, so stolen: the User is signed out everywhere.
      revokeEveryRefreshTokenOf(current.email);
    }
    const account = current && accounts.get(current.email);
    if (
      current === undefined ||
      account === undefined ||
      current.revoked ||
      current.expiresAt <= Date.now()
    ) {
      return errorResponse(401, 'Unauthorized');
    }
    current.revoked = true;
    current.rotated = true;
    return signedIn(account.user, 200);
  }),
  http.post('/api/auth/sign-out', () => {
    const current =
      refreshCookie === null ? undefined : refreshTokens.get(refreshCookie);
    if (current !== undefined) {
      current.revoked = true;
    }
    refreshCookie = null;
    return new HttpResponse(null, { status: 204 });
  }),
];
