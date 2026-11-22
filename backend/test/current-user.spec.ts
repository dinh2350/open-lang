import { randomUUID } from 'node:crypto';
import { userSchema } from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anotherSecret, signAuthToken } from './auth-tokens.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { registerUser } from './users.js';

describe('GET /api/auth/me (current User)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function currentUser(authToken?: string) {
    const call = request(app.getHttpServer()).get('/api/auth/me');
    return authToken === undefined
      ? call
      : call.auth(authToken, { type: 'bearer' });
  }

  it('returns the signed-in User', async () => {
    const { authToken, user } = await registerUser(app);

    const response = await currentUser(authToken);

    expect(response.status).toBe(200);
    expect(userSchema.parse(response.body)).toEqual(user);
  });

  it('returns 401 without an Auth Token', async () => {
    const response = await currentUser();

    expect(response.status).toBe(401);
  });

  it('returns 401 for a value that is not an Auth Token', async () => {
    const response = await currentUser('not-a-jwt');

    expect(response.status).toBe(401);
  });

  it('returns 401 for an Auth Token signed with another secret', async () => {
    const { user } = await registerUser(app);

    const response = await currentUser(
      signAuthToken(
        { sub: user.id, role: user.role },
        { secret: anotherSecret() },
      ),
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for an Auth Token issued more than 15 minutes ago', async () => {
    const { user } = await registerUser(app);
    const sixteenMinutesAgo = Math.floor(Date.now() / 1000) - 16 * 60;

    const response = await currentUser(
      signAuthToken({ sub: user.id, role: user.role, iat: sixteenMinutesAgo }),
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for an Auth Token whose subject is not a User id', async () => {
    const response = await currentUser(
      signAuthToken({ sub: 'ada@example.test', role: 'member' }),
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for a valid Auth Token whose User no longer exists', async () => {
    const response = await currentUser(
      signAuthToken({ sub: randomUUID(), role: 'member' }),
    );

    expect(response.status).toBe(401);
  });

  it('takes the Role from the database, not from the Auth Token', async () => {
    const { user } = await registerUser(app);

    const response = await currentUser(
      signAuthToken({ sub: user.id, role: 'admin' }),
    );

    expect(response.status).toBe(200);
    expect(userSchema.parse(response.body).role).toBe('member');
  });
});
