import { randomUUID } from 'node:crypto';
import {
  type AuthResponse,
  errorResponseSchema,
  userDetailsSchema,
} from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminApi, detailsOf } from './support/admin-api.js';
import { signInFirstAdmin, signInUser } from './support/admins.js';
import { holdUserChanges } from './database/user-changes.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('PUT /api/admin/users/:id/locked (lock and unlock a User)', () => {
  let app: INestApplication<App>;
  let admin: AuthResponse;
  let member: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    admin = await signInFirstAdmin(app, 'grace@example.test');
    member = await registerUser(app, 'ada@example.test');
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('lists a new User as not locked', async () => {
    expect(await detailsOf(app, admin.authToken, member.user.id)).toMatchObject(
      { locked: false },
    );
  });

  it("lets an Admin lock a User, and returns the User's details", async () => {
    const response = await adminApi(app, admin.authToken).changeLocked(
      member.user.id,
      { locked: true },
    );

    expect(response.status).toBe(200);
    expect(userDetailsSchema.parse(response.body)).toEqual({
      ...member.user,
      locked: true,
      createdAt: expect.any(String) as unknown,
    });
    expect(await detailsOf(app, admin.authToken, member.user.id)).toMatchObject(
      { locked: true },
    );
  });

  it('lets an Admin unlock a Locked User, who can sign in again', async () => {
    const admins = adminApi(app, admin.authToken);
    await admins.changeLocked(member.user.id, { locked: true });

    const response = await admins.changeLocked(member.user.id, {
      locked: false,
    });

    expect(response.status).toBe(200);
    expect(userDetailsSchema.parse(response.body).locked).toBe(false);
    const signedInAgain = await signInUser(app, 'ada@example.test');
    const currentUser = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(signedInAgain.authToken, { type: 'bearer' });
    expect(currentUser.status).toBe(200);
  });

  it('returns 409 to an Admin locking themselves', async () => {
    const response = await adminApi(app, admin.authToken).changeLocked(
      admin.user.id,
      { locked: true },
    );

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).message).toBe(
      "You can't lock yourself.",
    );
    expect(await detailsOf(app, admin.authToken, admin.user.id)).toMatchObject({
      locked: false,
    });
  });

  it('returns 409 to the second of two Admins locking each other at the same moment, so an unlocked Admin stays', async () => {
    await adminApi(app, admin.authToken).changeRole(member.user.id, {
      role: 'admin',
    });
    const userChanges = await holdUserChanges();
    const locks = Promise.all([
      adminApi(app, admin.authToken).changeLocked(member.user.id, {
        locked: true,
      }),
      adminApi(app, member.authToken).changeLocked(admin.user.id, {
        locked: true,
      }),
    ]);
    try {
      await userChanges.waitForQueuedQueries(2);
    } finally {
      await userChanges.release();
    }

    const responses = await locks;

    expect(
      responses.map((response) => response.status).toSorted((a, b) => a - b),
    ).toEqual([200, 409]);
    const refused = responses.find((response) => response.status === 409);
    expect(errorResponseSchema.parse(refused?.body).message).toBe(
      "You can't lock the last unlocked Admin.",
    );
    const currentUserStatuses = await Promise.all(
      [admin, member].map(
        async ({ authToken }) =>
          (
            await request(app.getHttpServer())
              .get('/api/auth/me')
              .auth(authToken, { type: 'bearer' })
          ).status,
      ),
    );
    expect(currentUserStatuses.toSorted((a, b) => a - b)).toEqual([200, 403]);
  });

  it('returns 403 to a Member', async () => {
    const response = await adminApi(app, member.authToken).changeLocked(
      admin.user.id,
      { locked: true },
    );

    expect(response.status).toBe(403);
    expect(await detailsOf(app, admin.authToken, admin.user.id)).toMatchObject({
      locked: false,
    });
  });

  it('returns 404 for a User id nobody has', async () => {
    const response = await adminApi(app, admin.authToken).changeLocked(
      randomUUID(),
      { locked: true },
    );

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).message).toBe(
      'No User has this id.',
    );
  });

  it.each([{}, { locked: 'yes' }])(
    'returns 400 for the body %j',
    async (body) => {
      const response = await adminApi(app, admin.authToken).changeLocked(
        member.user.id,
        body,
      );

      expect(response.status).toBe(400);
    },
  );
});
