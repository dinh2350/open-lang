import {
  changeRoleRequestSchema,
  type User,
  type UserDetails,
} from '@livekit-platform/shared';
import { http, HttpResponse } from 'msw';
import { backendUsers, changeRoleOnBackend } from './auth-backend';

const adminAuthorizations: (string | null)[] = [];

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
  return { ...user, createdAt: createdAtOfNthUser(n) };
}

/**
 * The backend's Admin API. Like the Room Token fake, it records the Auth
 * Token but leaves the Role guard and the `409` rules to the backend's own
 * tests; a test that needs a refusal overrides a handler.
 */
export const adminHandlers = [
  http.get('/api/admin/users', ({ request }) => {
    adminAuthorizations.push(request.headers.get('Authorization'));
    return HttpResponse.json({ users: backendUsers().map(withDetails) });
  }),
  http.put<{ id: string }>(
    '/api/admin/users/:id/role',
    async ({ request, params }) => {
      adminAuthorizations.push(request.headers.get('Authorization'));
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
