import { authResponseSchema } from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedFirstAdmin } from '../src/users/first-admin.js';
import { UsersService } from '../src/users/users.service.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { PASSWORD, registerUser } from './support/users.js';

describe('Seeding the first Admin (pnpm db:seed)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function seed(env: Record<string, string | undefined>) {
    return seedFirstAdmin(app.get(UsersService), env);
  }

  function signIn(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email, password });
  }

  it('creates an Admin from SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD when no Admin exists', async () => {
    await seed({
      SEED_ADMIN_EMAIL: 'grace@example.test',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    const response = await signIn('grace@example.test', PASSWORD);

    expect(response.status).toBe(200);
    expect(authResponseSchema.parse(response.body).user).toMatchObject({
      email: 'grace@example.test',
      role: 'admin',
    });
  });

  it('stores SEED_ADMIN_EMAIL lowercase, as registering does', async () => {
    await seed({
      SEED_ADMIN_EMAIL: ' Grace@Example.TEST ',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    const response = await signIn('grace@example.test', PASSWORD);

    expect(response.status).toBe(200);
  });

  it('does nothing when an Admin exists', async () => {
    await seed({
      SEED_ADMIN_EMAIL: 'grace@example.test',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    await seed({
      SEED_ADMIN_EMAIL: 'hopper@example.test',
      SEED_ADMIN_PASSWORD: 'another long password',
    });

    expect((await signIn('hopper@example.test', PASSWORD)).status).toBe(401);
    expect((await signIn('grace@example.test', PASSWORD)).status).toBe(200);
  });

  it('does nothing when an Admin exists, even without the SEED_ADMIN_ variables', async () => {
    await seed({
      SEED_ADMIN_EMAIL: 'grace@example.test',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    await expect(seed({})).resolves.toEqual({ outcome: 'admin-exists' });
  });

  it.each([
    ['SEED_ADMIN_EMAIL', 'missing', { SEED_ADMIN_PASSWORD: PASSWORD }],
    [
      'SEED_ADMIN_EMAIL',
      'not an email',
      { SEED_ADMIN_EMAIL: 'grace.example.test', SEED_ADMIN_PASSWORD: PASSWORD },
    ],
    [
      'SEED_ADMIN_PASSWORD',
      'missing',
      { SEED_ADMIN_EMAIL: 'grace@example.test' },
    ],
    [
      'SEED_ADMIN_PASSWORD',
      'shorter than 12 characters',
      {
        SEED_ADMIN_EMAIL: 'grace@example.test',
        SEED_ADMIN_PASSWORD: 'abcdefghijk',
      },
    ],
  ])(
    'refuses to create the first Admin when %s is %s, naming it',
    async (variable, _case, env) => {
      await expect(seed(env)).rejects.toThrow(
        new RegExp(`Invalid seed settings[\\s\\S]*${variable}`),
      );
      expect((await signIn('grace@example.test', PASSWORD)).status).toBe(401);
    },
  );

  it('refuses to make a Member who already has SEED_ADMIN_EMAIL an Admin', async () => {
    await registerUser(app, 'grace@example.test', PASSWORD);

    await expect(
      seed({
        SEED_ADMIN_EMAIL: 'grace@example.test',
        SEED_ADMIN_PASSWORD: 'another long password',
      }),
    ).rejects.toThrow(/SEED_ADMIN_EMAIL already belongs to a Member/);

    const response = await signIn('grace@example.test', PASSWORD);
    expect(authResponseSchema.parse(response.body).user.role).toBe('member');
  });
});
