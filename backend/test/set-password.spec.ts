import { randomUUID } from 'node:crypto';
import {
  type AuthResponse,
  errorResponseSchema,
} from '@livekit-platform/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminApi } from './admin-api.js';
import { signInFirstAdmin } from './admins.js';
import { refresh, signInForRefreshToken } from './refresh-cookies.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { PASSWORD, registerUser } from './users.js';

const NEW_PASSWORD = 'a brand new password for Ada';

describe('PUT /api/admin/users/:id/password (set a new password)', () => {
  let app: INestApplication<App>;
  let admin: AuthResponse;
  let ada: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    admin = await signInFirstAdmin(app, 'grace@example.test');
    ada = await registerUser(app, 'ada@example.test');
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function signInAsAda(password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'ada@example.test', password });
  }

  it('lets an Admin set a new password, which the User then signs in with', async () => {
    const response = await adminApi(app, admin.authToken).setPassword(
      ada.user.id,
      { password: NEW_PASSWORD },
    );

    expect(response.status).toBe(204);
    expect((await signInAsAda(NEW_PASSWORD)).status).toBe(200);
    expect((await signInAsAda(PASSWORD)).status).toBe(401);
  });

  it('signs the User out everywhere: every refresh token issued before stops working', async () => {
    const onOneDevice = await signInForRefreshToken(app);
    const onAnotherDevice = await signInForRefreshToken(app);

    await adminApi(app, admin.authToken).setPassword(ada.user.id, {
      password: NEW_PASSWORD,
    });

    expect((await refresh(app, onOneDevice)).status).toBe(401);
    expect((await refresh(app, onAnotherDevice)).status).toBe(401);
  });

  it('returns 400 for a password shorter than 12 characters, and keeps the old one', async () => {
    const response = await adminApi(app, admin.authToken).setPassword(
      ada.user.id,
      { password: 'x'.repeat(11) },
    );

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).message).toEqual([
      'password: Use at least 12 characters for the new password.',
    ]);
    expect((await signInAsAda(PASSWORD)).status).toBe(200);
  });

  it('returns 403 to a Member', async () => {
    const response = await adminApi(app, ada.authToken).setPassword(
      admin.user.id,
      { password: NEW_PASSWORD },
    );

    expect(response.status).toBe(403);
  });

  it('returns 404 for a User id nobody has', async () => {
    const response = await adminApi(app, admin.authToken).setPassword(
      randomUUID(),
      { password: NEW_PASSWORD },
    );

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).message).toBe(
      'No User has this id.',
    );
  });
});
