import { randomUUID } from 'node:crypto';
import {
  type AuthResponse,
  errorResponseSchema,
  userDetailsSchema,
  userSchema,
  usersResponseSchema,
} from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminApi } from './support/admin-api.js';
import { signInFirstAdmin, signInUser } from './support/admins.js';
import { holdUserChanges } from './database/user-changes.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('Admin Users API', () => {
  let app: INestApplication<App>;
  let admin: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    admin = await signInFirstAdmin(app, 'grace@example.test');
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function listUsers(authToken?: string) {
    const call = request(app.getHttpServer()).get('/api/admin/users');
    return authToken === undefined
      ? call
      : call.auth(authToken, { type: 'bearer' });
  }

  describe('GET /api/admin/users (list Users)', () => {
    it('returns 401 without an Auth Token', async () => {
      const response = await listUsers();

      expect(response.status).toBe(401);
    });

    it('returns 403 to a Member', async () => {
      const member = await registerUser(app, 'ada@example.test');

      const response = await listUsers(member.authToken);

      expect(response.status).toBe(403);
      expect(errorResponseSchema.parse(response.body).message).toBe(
        'Only Admins can do this.',
      );
    });

    it("shows an Admin every User's email, Role, locked state and creation date, oldest first", async () => {
      const beforeRegistering = Date.now();
      const member = await registerUser(app, 'ada@example.test');
      const afterRegistering = Date.now();

      const response = await listUsers(admin.authToken);

      expect(response.status).toBe(200);
      const { users } = usersResponseSchema.parse(response.body);
      expect(users).toEqual([
        {
          ...admin.user,
          locked: false,
          createdAt: expect.any(String) as unknown,
        },
        {
          ...member.user,
          locked: false,
          createdAt: expect.any(String) as unknown,
        },
      ]);
      const memberCreatedAt = Date.parse(users[1]?.createdAt ?? '');
      expect(memberCreatedAt).toBeGreaterThanOrEqual(beforeRegistering);
      expect(memberCreatedAt).toBeLessThanOrEqual(afterRegistering);
    });

    it('never returns password hashes', async () => {
      await registerUser(app, 'ada@example.test');

      const response = await listUsers(admin.authToken);

      expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });
  });

  describe('PUT /api/admin/users/:id/role (change a Role)', () => {
    let member: AuthResponse;

    beforeEach(async () => {
      member = await registerUser(app, 'ada@example.test');
    });

    function changeRole(authToken: string, userId: string, body: object) {
      return request(app.getHttpServer())
        .put(`/api/admin/users/${userId}/role`)
        .auth(authToken, { type: 'bearer' })
        .send(body);
    }

    async function roleOf(userId: string) {
      const { users } = usersResponseSchema.parse(
        (await listUsers(admin.authToken)).body,
      );
      return users.find((user) => user.id === userId)?.role;
    }

    it("lets an Admin make a Member an Admin, and returns the User's details", async () => {
      const response = await changeRole(admin.authToken, member.user.id, {
        role: 'admin',
      });

      expect(response.status).toBe(200);
      expect(userDetailsSchema.parse(response.body)).toEqual({
        ...member.user,
        role: 'admin',
        locked: false,
        createdAt: expect.any(String) as unknown,
      });
      expect(await roleOf(member.user.id)).toBe('admin');
    });

    it('gives a new Admin access to the Admin API on their next request, with the same Auth Token', async () => {
      await changeRole(admin.authToken, member.user.id, { role: 'admin' });

      const response = await listUsers(member.authToken);

      expect(response.status).toBe(200);
    });

    it('lets an Admin make another Admin a Member', async () => {
      await changeRole(admin.authToken, member.user.id, { role: 'admin' });

      const response = await changeRole(admin.authToken, member.user.id, {
        role: 'member',
      });

      expect(response.status).toBe(200);
      expect(await roleOf(member.user.id)).toBe('member');
    });

    it('takes Admin access away from a demoted Admin on their next request, whatever their Auth Token says', async () => {
      await changeRole(admin.authToken, member.user.id, { role: 'admin' });
      const signedInAsAdmin = await signInUser(app, 'ada@example.test');
      expect((await listUsers(signedInAsAdmin.authToken)).status).toBe(200);

      await changeRole(admin.authToken, member.user.id, { role: 'member' });

      expect((await listUsers(signedInAsAdmin.authToken)).status).toBe(403);
    });

    it('returns 409 to the second of two Admins demoting each other at the same moment, so the last Admin stays', async () => {
      await changeRole(admin.authToken, member.user.id, { role: 'admin' });
      const userChanges = await holdUserChanges();
      const demotions = Promise.all([
        changeRole(admin.authToken, member.user.id, { role: 'member' }),
        changeRole(member.authToken, admin.user.id, { role: 'member' }),
      ]);
      try {
        await userChanges.waitForQueuedQueries(2);
      } finally {
        await userChanges.release();
      }

      const responses = await demotions;

      expect(
        responses.map((response) => response.status).toSorted((a, b) => a - b),
      ).toEqual([200, 409]);
      const refused = responses.find((response) => response.status === 409);
      expect(errorResponseSchema.parse(refused?.body).message).toBe(
        "You can't demote the last unlocked Admin.",
      );
      const rolesNow = await Promise.all(
        [admin, member].map(async ({ authToken }) => {
          const response = await request(app.getHttpServer())
            .get('/api/auth/me')
            .auth(authToken, { type: 'bearer' });
          return userSchema.parse(response.body).role;
        }),
      );
      expect(new Set(rolesNow)).toEqual(new Set(['admin', 'member']));
    });

    it('counts only unlocked Admins: returns 409 to the second of two Admins demoting each other, even when a Locked Admin remains', async () => {
      const locked = await registerUser(app, 'alan@example.test');
      await changeRole(admin.authToken, locked.user.id, { role: 'admin' });
      await adminApi(app, admin.authToken).changeLocked(locked.user.id, {
        locked: true,
      });
      await changeRole(admin.authToken, member.user.id, { role: 'admin' });
      const userChanges = await holdUserChanges();
      const demotions = Promise.all([
        changeRole(admin.authToken, member.user.id, { role: 'member' }),
        changeRole(member.authToken, admin.user.id, { role: 'member' }),
      ]);
      try {
        await userChanges.waitForQueuedQueries(2);
      } finally {
        await userChanges.release();
      }

      const responses = await demotions;

      expect(
        responses.map((response) => response.status).toSorted((a, b) => a - b),
      ).toEqual([200, 409]);
      const refused = responses.find((response) => response.status === 409);
      expect(errorResponseSchema.parse(refused?.body).message).toBe(
        "You can't demote the last unlocked Admin.",
      );
    });

    it('returns 403 to a Member', async () => {
      const response = await changeRole(member.authToken, member.user.id, {
        role: 'admin',
      });

      expect(response.status).toBe(403);
      expect(await roleOf(member.user.id)).toBe('member');
    });

    it.each(['member', 'admin'])(
      "returns 409 to an Admin changing their own Role to '%s'",
      async (role) => {
        const response = await changeRole(admin.authToken, admin.user.id, {
          role,
        });

        expect(response.status).toBe(409);
        expect(errorResponseSchema.parse(response.body).message).toBe(
          "You can't change your own Role.",
        );
        expect(await roleOf(admin.user.id)).toBe('admin');
      },
    );

    it('returns 404 for a User id nobody has', async () => {
      const response = await changeRole(admin.authToken, randomUUID(), {
        role: 'admin',
      });

      expect(response.status).toBe(404);
    });

    it('returns 400 for a User id that is not a UUID', async () => {
      const response = await changeRole(admin.authToken, 'ada', {
        role: 'admin',
      });

      expect(response.status).toBe(400);
    });

    it('returns 400 for a Role that does not exist', async () => {
      const response = await changeRole(admin.authToken, member.user.id, {
        role: 'owner',
      });

      expect(response.status).toBe(400);
      expect(await roleOf(member.user.id)).toBe('member');
    });
  });
});
