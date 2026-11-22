import {
  type AuthResponse,
  roomTokenResponseSchema,
  type RoomTokenRequest,
} from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import { type ClaimGrants, TokenVerifier } from 'livekit-server-sdk';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signInFirstAdmin } from './support/admins.js';
import { startTestApp, stopTestApp, testEnv } from './support/test-app.js';
import { registerUser } from './support/users.js';

const TEN_MINUTES_IN_SECONDS = 600;

describe('POST /api/token (Room Token endpoint)', () => {
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

  function postRoomTokenRequest(body: object, authToken?: string) {
    const call = request(app.getHttpServer()).post('/api/token').send(body);
    return authToken === undefined
      ? call
      : call.auth(authToken, { type: 'bearer' });
  }

  async function requestRoomToken(body: RoomTokenRequest = {}) {
    const response = await postRoomTokenRequest(body, signedIn.authToken);
    expect(response.status).toBe(201);
    const roomToken = roomTokenResponseSchema.parse(response.body);
    const claims = await verifier.verify(roomToken.participant_token);
    return { roomToken, claims };
  }

  function agentNamesDispatchedBy(claims: ClaimGrants): string[] {
    return (claims.roomConfig?.agents ?? []).map((agent) => agent.agentName);
  }

  it('returns 401 without an Auth Token', async () => {
    const response = await postRoomTokenRequest({});

    expect(response.status).toBe(401);
  });

  it('returns 201 with the LiveKit server URL and a Room Token signed with the LiveKit API key', async () => {
    const { roomToken, claims } = await requestRoomToken();

    expect(roomToken.server_url).toBe(testEnv.LIVEKIT_URL);
    expect(claims.iss).toBe(testEnv.LIVEKIT_API_KEY);
  });

  it("makes the signed-in User's id the participant identity", async () => {
    const { claims } = await requestRoomToken();

    expect(claims.sub).toBe(signedIn.user.id);
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

  it('gives every request a new room', async () => {
    const first = await requestRoomToken();
    const second = await requestRoomToken();

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
    expect(claims.sub).toBe(signedIn.user.id);
    expect(claims.name).toBeFalsy();
    expect(claims.metadata).toBeFalsy();
    expect(claims.attributes ?? {}).toEqual({});
    expect(agentNamesDispatchedBy(claims)).toEqual([testEnv.AGENT_NAME]);
  });

  it('issues an Admin a Room Token too, as for any Member', async () => {
    const admin = await signInFirstAdmin(app);

    const response = await postRoomTokenRequest({}, admin.authToken);

    expect(response.status).toBe(201);
    const roomToken = roomTokenResponseSchema.parse(response.body);
    const claims = await verifier.verify(roomToken.participant_token);
    expect(claims.sub).toBe(admin.user.id);
  });

  it('rejects a body that is not in the standard token request shape', async () => {
    const response = await postRoomTokenRequest(
      { room_name: 42 },
      signedIn.authToken,
    );

    expect(response.status).toBe(400);
  });
});
