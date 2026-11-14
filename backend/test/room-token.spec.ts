import {
  roomTokenResponseSchema,
  type RoomTokenRequest,
} from '@livekit-platform/shared';
import type { INestApplication } from '@nestjs/common';
import { type ClaimGrants, TokenVerifier } from 'livekit-server-sdk';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, stopTestApp, testEnv } from './test-app.js';

const TEN_MINUTES_IN_SECONDS = 600;

describe('POST /api/token (Room Token endpoint)', () => {
  let app: INestApplication<App>;
  const verifier = new TokenVerifier(
    testEnv.LIVEKIT_API_KEY,
    testEnv.LIVEKIT_API_SECRET,
  );

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await stopTestApp(app);
  });

  async function requestRoomToken(body: RoomTokenRequest = {}) {
    const response = await request(app.getHttpServer())
      .post('/api/token')
      .send(body)
      .expect(201);
    const roomToken = roomTokenResponseSchema.parse(response.body);
    const claims = await verifier.verify(roomToken.participant_token);
    return { roomToken, claims };
  }

  function agentNamesDispatchedBy(claims: ClaimGrants): string[] {
    return (claims.roomConfig?.agents ?? []).map((agent) => agent.agentName);
  }

  it('returns 201 with the LiveKit server URL and a Room Token signed with the LiveKit API key', async () => {
    const { roomToken, claims } = await requestRoomToken();

    expect(roomToken.server_url).toBe(testEnv.LIVEKIT_URL);
    expect(claims.iss).toBe(testEnv.LIVEKIT_API_KEY);
  });

  it('grants join, publish and subscribe for its own room only', async () => {
    const { claims } = await requestRoomToken();

    expect(claims.video).toEqual({
      room: expect.stringMatching(/\S/) as unknown,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
  });

  it('gives every request a new room and a new participant identity', async () => {
    const first = await requestRoomToken();
    const second = await requestRoomToken();

    expect(first.claims.sub).toMatch(/\S/);
    expect(second.claims.sub).not.toBe(first.claims.sub);
    expect(second.claims.video?.room).not.toBe(first.claims.video?.room);
  });

  it('dispatches the Agent named AGENT_NAME into the room', async () => {
    const { claims } = await requestRoomToken();

    expect(agentNamesDispatchedBy(claims)).toEqual([testEnv.AGENT_NAME]);
  });

  it('expires the Room Token after 10 minutes', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { claims } = await requestRoomToken();
    const after = Math.ceil(Date.now() / 1000);

    expect(claims.exp).toBeGreaterThanOrEqual(before + TEN_MINUTES_IN_SECONDS);
    expect(claims.exp).toBeLessThanOrEqual(after + TEN_MINUTES_IN_SECONDS);
  });

  it('ignores every client-supplied field', async () => {
    const { claims } = await requestRoomToken({
      room_name: 'someone-elses-room',
      participant_identity: 'someone-else',
      participant_name: 'Someone Else',
      participant_metadata: '{"role":"admin"}',
      participant_attributes: { role: 'admin' },
      room_config: { agents: [{ agent_name: 'another-agent' }] },
    });

    expect(claims.video?.room).not.toBe('someone-elses-room');
    expect(claims.sub).not.toBe('someone-else');
    expect(claims.name).toBeFalsy();
    expect(claims.metadata).toBeFalsy();
    expect(claims.attributes ?? {}).toEqual({});
    expect(agentNamesDispatchedBy(claims)).toEqual([testEnv.AGENT_NAME]);
  });

  it('rejects a body that is not in the standard token request shape', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/token')
      .send({ room_name: 42 });

    expect(response.status).toBe(400);
  });
});
