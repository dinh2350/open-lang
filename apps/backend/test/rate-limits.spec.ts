import { errorResponseSchema } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { PASSWORD, registerUser } from './support/users.js';

const ONE_MINUTE = 60_000;

describe('Rate limits on register and sign-in', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await stopTestApp(app);
  });

  function register(email: string) {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD });
  }

  function signIn(password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'ada@example.test', password });
  }

  /** Sends the requests one after the other and returns their statuses. */
  async function statusesOf(
    requests: readonly (() => request.Test)[],
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (const send of requests) {
      statuses.push((await send()).status);
    }
    return statuses;
  }

  function fiveTimes<T>(make: (attempt: number) => T): T[] {
    return [1, 2, 3, 4, 5].map(make);
  }

  /** Registers user1@example.test to user5@example.test. */
  function registerFiveUsers(): Promise<number[]> {
    return statusesOf(
      fiveTimes(
        (attempt) => () => register(`user${String(attempt)}@example.test`),
      ),
    );
  }

  it('lets one IP register 5 times a minute, then answers 429 with a clear message', async () => {
    const statuses = await registerFiveUsers();
    const sixth = await register('user6@example.test');

    expect(statuses).toEqual([201, 201, 201, 201, 201]);
    expect(sixth.status).toBe(429);
    expect(errorResponseSchema.parse(sixth.body).message).toBe(
      'Too many attempts. Wait a minute, then try again.',
    );
  });

  it('counts every sign-in attempt, so a 6th within a minute gets 429 even with the right password', async () => {
    await registerUser(app, 'ada@example.test', PASSWORD);

    const statuses = await statusesOf(
      fiveTimes(() => () => signIn('not the right password')),
    );
    const sixth = await signIn(PASSWORD);

    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    expect(sixth.status).toBe(429);
  });

  it('limits register and sign-in separately', async () => {
    await registerFiveUsers();

    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'user1@example.test', password: PASSWORD });

    expect(response.status).toBe(200);
  });

  it('counts each browser behind the dev proxy on this host by the IP the proxy forwards', async () => {
    const fromOneBrowser = (email: string) =>
      register(email).set('X-Forwarded-For', '203.0.113.1');
    const fromAnotherBrowser = (email: string) =>
      register(email).set('X-Forwarded-For', '203.0.113.2');

    const statuses = await statusesOf(
      fiveTimes(
        (attempt) => () =>
          fromOneBrowser(`user${String(attempt)}@example.test`),
      ),
    );
    const sixth = await fromOneBrowser('user6@example.test');
    const fromAnother = await fromAnotherBrowser('user7@example.test');

    expect(statuses).toEqual([201, 201, 201, 201, 201]);
    expect(sixth.status).toBe(429);
    expect(fromAnother.status).toBe(201);
  });

  it('lets the IP try again a minute later', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await registerFiveUsers();
    expect((await register('user6@example.test')).status).toBe(429);

    vi.setSystemTime(Date.now() + ONE_MINUTE + 1000);

    expect((await register('user6@example.test')).status).toBe(201);
  });
});
