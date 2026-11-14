import {
  accountLockedResponseSchema,
  type AuthResponse,
  errorResponseSchema,
} from '@livekit-platform/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { adminApi } from './admin-api.js';
import { signInFirstAdmin } from './admins.js';
import { refresh, signInForRefreshToken } from './refresh-cookies.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { PASSWORD, registerUser } from './users.js';

const ACCOUNT_LOCKED_MESSAGE =
  'Your account is locked. Ask an Admin to unlock it.';

describe('A Locked User', () => {
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

  async function setAdaLocked(locked: boolean): Promise<void> {
    const response = await adminApi(app, admin.authToken).changeLocked(
      ada.user.id,
      { locked },
    );
    expect(response.status).toBe(200);
  }

  const lockAda = () => setAdaLocked(true);
  const unlockAda = () => setAdaLocked(false);

  function signIn(password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'ada@example.test', password });
  }

  describe('signing in', () => {
    it('gets 403 with the account locked message for the right password, and no refresh cookie', async () => {
      await lockAda();

      const response = await signIn(PASSWORD);

      expect(response.status).toBe(403);
      expect(accountLockedResponseSchema.parse(response.body).message).toBe(
        ACCOUNT_LOCKED_MESSAGE,
      );
      expect(response.get('Set-Cookie')).toBeUndefined();
    });

    it('gets the same generic 401 as anyone else for a wrong password', async () => {
      await lockAda();

      const response = await signIn('not the right password');

      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(response.body).message).toBe(
        'Wrong email or password.',
      );
    });
  });

  describe('refreshing', () => {
    it('gets 401 for a refresh token issued before the lock', async () => {
      const refreshToken = await signInForRefreshToken(app);
      await lockAda();

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(401);
    });

    it('stays signed out everywhere after an unlock: the lock revoked every refresh token', async () => {
      const onOneDevice = await signInForRefreshToken(app);
      const onAnotherDevice = await signInForRefreshToken(app);
      await lockAda();
      await unlockAda();

      expect((await refresh(app, onOneDevice)).status).toBe(401);
      expect((await refresh(app, onAnotherDevice)).status).toBe(401);
    });

    it('gets 401 even for a refresh token the lock missed, as when a refresh raced the lock', async () => {
      const refreshToken = await signInForRefreshToken(app);
      // The state a lock leaves behind when a concurrent refresh stored its
      // new refresh token after the lock revoked the User's refresh tokens.
      await app
        .get(PrismaService)
        .user.update({ where: { id: ada.user.id }, data: { locked: true } });

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(401);
    });
  });

  describe('with an Auth Token issued before the lock', () => {
    it.each([
      ['GET', '/api/auth/me'],
      ['POST', '/api/token'],
    ] as const)(
      'gets 403 with the account locked message from %s %s',
      async (method, path) => {
        await lockAda();

        const response = await request(app.getHttpServer())
          [method === 'GET' ? 'get' : 'post'](path)
          .auth(ada.authToken, { type: 'bearer' })
          .send({});

        expect(response.status).toBe(403);
        expect(accountLockedResponseSchema.parse(response.body).message).toBe(
          ACCOUNT_LOCKED_MESSAGE,
        );
      },
    );
  });
});
