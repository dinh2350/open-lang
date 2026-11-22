import {
  type ChangeLockedRequest,
  type ChangeRoleRequest,
  errorResponseSchema,
  type Role,
  type SetPasswordRequest,
  type UserDetails,
  userDetailsSchema,
  usersResponseSchema,
} from '@open-lang/shared';
import { BackendRefusal } from '@/auth/auth-api';
import type { AuthorizedFetch } from '@/auth/auth-context';

/**
 * Parses a successful response with `parse`. A refusal, such as a `409`,
 * becomes a BackendRefusal with the backend's message.
 */
async function readResponse<T>(
  path: string,
  response: Response,
  parse: (body: unknown) => T,
): Promise<T> {
  if (response.ok) {
    return parse(await response.json());
  }
  return refused(path, response);
}

/**
 * Throws for a response that isn't successful: a BackendRefusal with the
 * backend's message for a `4xx`, such as a `409`, and an Error otherwise.
 */
async function refused(path: string, response: Response): Promise<never> {
  if (response.status >= 500) {
    throw new Error(`${path} failed with status ${String(response.status)}`);
  }
  const { message } = errorResponseSchema.parse(await response.json());
  throw new BackendRefusal(
    Array.isArray(message) ? message.join(' ') : message,
  );
}

/** Every User, oldest first. Admins only. */
export async function listUsers(
  authorizedFetch: AuthorizedFetch,
): Promise<UserDetails[]> {
  const path = '/api/admin/users';
  const response = await authorizedFetch(path);
  const { users } = await readResponse(path, response, (body) =>
    usersResponseSchema.parse(body),
  );
  return users;
}

/** Changes something about a User with a PUT, and returns their details. */
async function changeUser(
  authorizedFetch: AuthorizedFetch,
  userId: string,
  change: 'role' | 'locked',
  request: ChangeRoleRequest | ChangeLockedRequest,
): Promise<UserDetails> {
  const path = `/api/admin/users/${encodeURIComponent(userId)}/${change}`;
  const response = await authorizedFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readResponse(path, response, (body) => userDetailsSchema.parse(body));
}

/** Changes another User's Role. Admins only. */
export function changeRole(
  authorizedFetch: AuthorizedFetch,
  userId: string,
  role: Role,
): Promise<UserDetails> {
  return changeUser(authorizedFetch, userId, 'role', { role });
}

/** Locks or unlocks another User. Admins only. */
export function changeLocked(
  authorizedFetch: AuthorizedFetch,
  userId: string,
  locked: boolean,
): Promise<UserDetails> {
  return changeUser(authorizedFetch, userId, 'locked', { locked });
}

/**
 * Sets a new password for another User, which signs them out everywhere.
 * Admins only.
 */
export async function setPassword(
  authorizedFetch: AuthorizedFetch,
  userId: string,
  password: string,
): Promise<void> {
  const path = `/api/admin/users/${encodeURIComponent(userId)}/password`;
  const request: SetPasswordRequest = { password };
  const response = await authorizedFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    await refused(path, response);
  }
}
