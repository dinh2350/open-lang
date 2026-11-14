import {
  changeRoleRequestSchema,
  type User,
  type UserDetails,
} from '@livekit-platform/shared';
import { http, HttpResponse } from 'msw';
import {
  backendUsers,
  changeRoleOnBackend,
  refusalOfAuthorization,
} from './auth-backend';

const adminAuthorizations: (string | null)[] = [];

/**
 * Records the request's `Authorization` header, and answers as the
 * backend's authentication guard would: `401` without a valid Auth Token,
 * `403` for a Locked User. Resolves to `undefined` when it may go through.
 */
function guard(request: Request): Response | undefined {
  const authorization = request.headers.get('Authorization');
  adminAuthorizations.push(authorization);
  return refusalOfAuthorization(authorization ?? '');
}

/** The `Authorization` header of every Admin API request, oldest first. */
export function adminRequestAuthorizations(): readonly (string | null)[] {
  return adminAuthorizations;
}

export function resetAdminBackend(): void {
  adminAuthorizations.length = 0;
}

/**
 * The n-th User registered at noon UTC on November n, 2026, so the date
 * reads the same in every time zone within 11 hours of UTC.
 */
export function createdAtOfNthUser(n: number): string {
  return `2026-11-${String(n).padStart(2, '0')}T12:00:00.000Z`;
}

function withDetails(user: User): UserDetails {
  const n = backendUsers().findIndex((other) => other.id === user.id) + 1;
  return { ...user, locked: false, createdAt: createdAtOfNthUser(n) };
}

/**
 * The backend's Admin API. It checks the Auth Token like the backend's
 * authentication guard, but leaves the Role guard and the `409` rules to the
 * backend's own tests; a test that needs a refusal overrides a handler.
 */
export const adminHandlers = [
  http.get('/api/admin/users', ({ request }) => {
    return (
      guard(request) ??
      HttpResponse.json({ users: backendUsers().map(withDetails) })
    );
  }),
  http.put<{ id: string }>(
    '/api/admin/users/:id/role',
    async ({ request, params }) => {
      const refusal = guard(request);
      if (refusal !== undefined) {
        return refusal;
      }
      const { role } = changeRoleRequestSchema.parse(await request.json());
      const user = changeRoleOnBackend(params.id, role);
      return user === undefined
        ? HttpResponse.json(
            { statusCode: 404, message: 'No User has this id.' },
            { status: 404 },
          )
        : HttpResponse.json(withDetails(user));
    },
  ),
];
