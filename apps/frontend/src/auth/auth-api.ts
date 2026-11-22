import {
  accountLockedResponseSchema,
  type AuthResponse,
  authResponseSchema,
  errorResponseSchema,
  type RegisterRequest,
  type SignInRequest,
} from '@open-live-agent/shared';

/** The backend turned a request down, with a message meant for the person. */
export class BackendRefusal extends Error {}

async function requestAuthResponse(
  path: string,
  credentials: RegisterRequest | SignInRequest,
): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (response.ok) {
    return authResponseSchema.parse(await response.json());
  }
  if (response.status >= 500) {
    throw new Error(`${path} failed with status ${String(response.status)}`);
  }
  const { message } = errorResponseSchema.parse(await response.json());
  throw new BackendRefusal(
    Array.isArray(message) ? message.join(' ') : message,
  );
}

/** Creates a Member and signs them in. */
export function register(credentials: RegisterRequest): Promise<AuthResponse> {
  return requestAuthResponse('/api/auth/register', credentials);
}

export function signIn(credentials: SignInRequest): Promise<AuthResponse> {
  return requestAuthResponse('/api/auth/sign-in', credentials);
}

/**
 * Signs the User in again with the refresh cookie the browser holds, and
 * rotates that cookie. Resolves to `null` when that doesn't work: the
 * backend refuses a missing, expired or revoked cookie, or can't be
 * reached. Either way, the person counts as signed out.
 */
export async function refresh(): Promise<AuthResponse | null> {
  const response = await fetch('/api/auth/refresh', { method: 'POST' }).catch(
    () => null,
  );
  return response?.ok === true
    ? authResponseSchema.parse(await response.json())
    : null;
}

/** Revokes the refresh cookie on the backend, which also clears it. */
export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/sign-out', { method: 'POST' });
  if (!response.ok) {
    throw new Error(
      `Signing out failed with status ${String(response.status)}`,
    );
  }
}

const FORBIDDEN = 403;

/**
 * The account locked message, when the backend answered a request with the
 * `403` it gives a Locked User. `null` for any other response, including
 * other `403`s such as a Member calling the Admin API.
 */
export async function accountLockedMessageOf(
  response: Response,
): Promise<string | null> {
  if (response.status !== FORBIDDEN) {
    return null;
  }
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const locked = accountLockedResponseSchema.safeParse(body);
  return locked.success ? locked.data.message : null;
}
