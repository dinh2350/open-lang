import { type AuthResponse, roomTokenResponseSchema } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import { TokenVerifier } from 'livekit-server-sdk';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { startTestApp, stopTestApp, testEnv } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('The Conversation created with each Room Token', () => {
  let app: INestApplication<App>;
  let signedIn: AuthResponse;
  const verifier = new TokenVerifier(
    testEnv.LIVEKIT_API_KEY,
    testEnv.LIVEKIT_API_SECRET,
  );

  beforeEach(async () => {
    app = await startTestApp();
    signedIn = await registerUser(app);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  async function requestRoomToken() {
    const response = await request(app.getHttpServer())
      .post('/api/token')
      .auth(signedIn.authToken, { type: 'bearer' })
      .send({});
    expect(response.status).toBe(201);
    const roomToken = roomTokenResponseSchema.parse(response.body);
    return verifier.verify(roomToken.participant_token);
  }

  it('records a Conversation without a Scenario', async () => {
    const claims = await requestRoomToken();

    const conversations = await app
      .get(PrismaService)
      .conversation.findMany({ where: { userId: signedIn.user.id } });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      userId: signedIn.user.id,
      roomName: claims.video?.room,
    });
    expect(conversations[0]).not.toHaveProperty('scenarioId');
    expect(conversations[0]).not.toHaveProperty('speed');
  });

  it('creates one Conversation per token request', async () => {
    await requestRoomToken();
    await requestRoomToken();

    const conversations = await app
      .get(PrismaService)
      .conversation.findMany({ where: { userId: signedIn.user.id } });
    expect(conversations).toHaveLength(2);
    expect(new Set(conversations.map((c) => c.roomName)).size).toBe(2);
  });
});
