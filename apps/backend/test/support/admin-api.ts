import { type UserDetails, usersResponseSchema } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

/** Calls the Admin API as the User of this Auth Token. */
export function adminApi(app: INestApplication<App>, authToken: string) {
  const put = (path: string, body: object) =>
    request(app.getHttpServer())
      .put(`/api/admin/users/${path}`)
      .auth(authToken, { type: 'bearer' })
      .send(body);
  return {
    listUsers: () =>
      request(app.getHttpServer())
        .get('/api/admin/users')
        .auth(authToken, { type: 'bearer' }),
    changeRole: (userId: string, body: object) => put(`${userId}/role`, body),
    changeLocked: (userId: string, body: object) =>
      put(`${userId}/locked`, body),
    setPassword: (userId: string, body: object) =>
      put(`${userId}/password`, body),
  };
}

/** A User's details as the Admin API lists them. */
export async function detailsOf(
  app: INestApplication<App>,
  adminAuthToken: string,
  userId: string,
): Promise<UserDetails | undefined> {
  const response = await adminApi(app, adminAuthToken).listUsers();
  const { users } = usersResponseSchema.parse(response.body);
  return users.find((user) => user.id === userId);
}
