import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_PREFIX, AUTH_PATH } from '../src/routes.js';
import { refreshCookieSetBy } from './refresh-cookies.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { PASSWORD } from './users.js';

describe('The route constants', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('serve the auth routes under the API prefix and scope the refresh cookie to them', async () => {
    const response = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/${AUTH_PATH}/register`)
      .send({ email: 'ada@example.test', password: PASSWORD });

    expect(response.status).toBe(201);
    expect(refreshCookieSetBy(response).path).toBe(
      `/${API_PREFIX}/${AUTH_PATH}`,
    );
  });
});
