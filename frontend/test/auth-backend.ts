import {
  ACCOUNT_LOCKED,
  registerRequestSchema,
  type Role,
  signInRequestSchema,
  type User,
} from '@livekit-platform/shared';
import { http, HttpResponse } from 'msw';

/** The message the backend gives a Locked User with its `403`. */
export const ACCOUNT_LOCKED_MESSAGE =
  'Your account is locked. Ask an Admin to unlock it.';

const AUTH_TOKEN_LIFETIME_MILLISECONDS = 15 * 60_000;
const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60_000;

interface Account {
  readonly user: User;
  readonly password: string;
  readonly locked: boolean;
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
/** The email of the User each Auth Token was issued to. */
const authTokenOwners = new Map<string, string>();
const refreshTokens = new Map<string, RefreshToken>();
const authRequests: string[] = [];
let refreshes = 0;

/**
 * The refresh cookie the browser holds. The fetch that jsdom tests use
 * keeps no cookies, so the fake backend keeps the browser's cookie too.
 */
let refreshCookie: string | null = null;

/** The backend already has this User, as if they had registered earlier. */
export function backendHasUser(
  email: string,
  password: string,
  role: Role = 'member',
): User {
  const user: User = { id: `user-${String(accounts.size + 1)}`, email, role };
  accounts.set(email, { user, password, locked: false });
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
export function browserIsSignedInAs(
  email: string,
  password: string,
  role: Role = 'member',
): User {
  const user = backendHasUser(email, password, role);
  issueRefreshCookie(email);
  return user;
}

/** Every User the backend has, in the order they registered. */
export function backendUsers(): readonly User[] {
  return [...accounts.values()].map((account) => account.user);
}

function accountWithId(userId: string): Account | undefined {
  return [...accounts.values()].find((account) => account.user.id === userId);
}

/** Changes a User's Role on the backend. Returns the User, or `undefined` for an unknown id. */
export function changeRoleOnBackend(
  userId: string,
  role: Role,
): User | undefined {
  const account = accountWithId(userId);
  if (account === undefined) {
    return undefined;
  }
  const user = { ...account.user, role };
  accounts.set(user.email, { ...account, user });
  return user;
}

/**
 * Locks or unlocks a User on the backend. Locking revokes every refresh
 * token of that User. Returns the User, or `undefined` for an unknown id.
 */
export function changeLockedOnBackend(
  userId: string,
  locked: boolean,
): User | undefined {
  const account = accountWithId(userId);
  if (account === undefined) {
    return undefined;
  }
  accounts.set(account.user.email, { ...account, locked });
  if (locked) {
    revokeEveryRefreshTokenOf(account.user.email);
  }
  return account.user;
}

/** Whether the User with this email is locked on the backend. */
export function isLockedOnBackend(email: string): boolean {
  return accounts.get(email)?.locked === true;
}

/**
 * Sets a new password for a User on the backend, which revokes every
 * refresh token of that User. Returns the User, or `undefined` for an
 * unknown id.
 */
export function setPasswordOnBackend(
  userId: string,
  password: string,
): User | undefined {
  const account = accountWithId(userId);
  if (account === undefined) {
    return undefined;
  }
  accounts.set(account.user.email, { ...account, password });
  revokeEveryRefreshTokenOf(account.user.email);
  return account.user;
}

/** The password the User with this email signs in with. */
export function passwordOnBackend(email: string): string | undefined {
  return accounts.get(email)?.password;
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

/** The backend's answer to a Locked User: `403` with the account locked error code. */
function accountLockedResponse() {
  return HttpResponse.json(
    {
      statusCode: 403,
      error: 'Forbidden',
      errorCode: ACCOUNT_LOCKED,
      message: ACCOUNT_LOCKED_MESSAGE,
    },
    { status: 403 },
  );
}

/**
 * What the backend's authentication guard answers to an `Authorization`
 * header: `401` unless it holds an Auth Token this backend issued less than
 * 15 minutes ago, and `403` when that Auth Token's User is locked. Resolves
 * to `undefined` when the request may go through.
 */
export function refusalOfAuthorization(
  authorization: string,
): Response | undefined {
  const authToken = /^Bearer (\S+)$/.exec(authorization)?.[1] ?? '';
  if ((authTokenExpiries.get(authToken) ?? 0) <= Date.now()) {
    return errorResponse(401, 'Unauthorized');
  }
  const owner = accounts.get(authTokenOwners.get(authToken) ?? '');
  return owner?.locked === true ? accountLockedResponse() : undefined;
}

export function resetAuthBackend(): void {
  accounts.clear();
  issuedAuthTokens.length = 0;
  authTokenExpiries.clear();
  authTokenOwners.clear();
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
  authTokenOwners.set(authToken, user.email);
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
    if (account.locked) {
      return accountLockedResponse();
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
      account.locked ||
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
