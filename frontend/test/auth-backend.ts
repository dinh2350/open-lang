import {
  registerRequestSchema,
  type Role,
  signInRequestSchema,
  type User,
} from '@livekit-platform/shared';
import { http, HttpResponse } from 'msw';

interface Account {
  readonly user: User;
  readonly password: string;
}

const accounts = new Map<string, Account>();
const issuedAuthTokens: string[] = [];
const authRequests: string[] = [];

/** The backend already has this User, as if they had registered earlier. */
export function backendHasUser(
  email: string,
  password: string,
  role: Role = 'member',
): User {
  const user: User = { id: `user-${String(accounts.size + 1)}`, email, role };
  accounts.set(email, { user, password });
  return user;
}

/** Every User the backend has, in the order they registered. */
export function backendUsers(): readonly User[] {
  return [...accounts.values()].map((account) => account.user);
}

/** Changes a User's Role on the backend. Returns the User, or `undefined` for an unknown id. */
export function changeRoleOnBackend(
  userId: string,
  role: Role,
): User | undefined {
  const account = [...accounts.values()].find(
    (candidate) => candidate.user.id === userId,
  );
  if (account === undefined) {
    return undefined;
  }
  const user = { ...account.user, role };
  accounts.set(user.email, { ...account, user });
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

export function resetAuthBackend(): void {
  accounts.clear();
  issuedAuthTokens.length = 0;
  authRequests.length = 0;
}

function signedIn(user: User, status: number) {
  const authToken = `auth-token-${String(issuedAuthTokens.length + 1)}`;
  issuedAuthTokens.push(authToken);
  return HttpResponse.json({ authToken, user }, { status });
}

function errorResponse(status: number, message: string) {
  return HttpResponse.json({ statusCode: status, message }, { status });
}

/** The backend's register and sign-in endpoints, with its rules for both. */
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
];
