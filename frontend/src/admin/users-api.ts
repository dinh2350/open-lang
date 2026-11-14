import {
  type ChangeRoleRequest,
  errorResponseSchema,
  type Role,
  type UserDetails,
  userDetailsSchema,
  usersResponseSchema,
} from '@livekit-platform/shared';
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

/** Changes another User's Role. Admins only. */
export async function changeRole(
  authorizedFetch: AuthorizedFetch,
  userId: string,
  role: Role,
): Promise<UserDetails> {
  const path = `/api/admin/users/${encodeURIComponent(userId)}/role`;
  const request: ChangeRoleRequest = { role };
  const response = await authorizedFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return readResponse(path, response, (body) => userDetailsSchema.parse(body));
}
