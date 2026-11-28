import {
  type AuthResponse,
  learnerBriefSchema,
  roomTokenResponseSchema,
  type RoomTokenRequest,
} from '@open-lang/shared';
import { type INestApplication, Logger } from '@nestjs/common';
import { type ClaimGrants, TokenVerifier } from 'livekit-server-sdk';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnerService } from '../src/learner/learner.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { signInFirstAdmin } from './support/admins.js';
import { day, endedConversation, learnerItemData } from './support/learner.js';
import { startTestApp, stopTestApp, testEnv } from './support/test-app.js';
import { registerUser } from './support/users.js';

const TEN_MINUTES_IN_SECONDS = 600;

describe('POST /api/token (Room Token endpoint)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signedIn: AuthResponse;
  const verifier = new TokenVerifier(
    testEnv.LIVEKIT_API_KEY,
    testEnv.LIVEKIT_API_SECRET,
  );

  beforeEach(async () => {
    app = await startTestApp();
    prisma = app.get(PrismaService);
    signedIn = await registerUser(app);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  const storedConversations = () => prisma.conversation.count();

  function agentNamesDispatchedBy(claims: ClaimGrants): string[] {
    return (claims.roomConfig?.agents ?? []).map((agent) => agent.agentName);
  }

  /** The dispatch metadata of the Room Token; empty when it has none. */
  const metadataOf = (claims: ClaimGrants): string =>
    claims.roomConfig?.agents[0]?.metadata ?? '';

  /** A learner item of the User: the phrase "I'd like to reschedule the meeting." */
  const phraseOf = (userId: string) =>
    learnerItemData(userId, {
      kind: 'phrase',
      english: "I'd like to reschedule the meeting.",
      meaning: 'Tôi muốn dời cuộc họp.',
      key: "i'd like to reschedule the meeting",
    });

  it('returns 401 without an Auth Token', async () => {
    const response = await postRoomTokenRequest({});

    expect(response.status).toBe(401);
    expect(await storedConversations()).toBe(0);
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
      participant_metadata: JSON.stringify({ role: 'admin' }),
      room_name: 'someone-elses-room',
      participant_identity: 'someone-else',
      participant_name: 'Someone Else',
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

  it('issues a Room Token without any choice', async () => {
    const response = await postRoomTokenRequest({}, signedIn.authToken);

    expect(response.status).toBe(201);
    const roomToken = roomTokenResponseSchema.parse(response.body);
    const claims = await verifier.verify(roomToken.participant_token);
    const agents = claims.roomConfig?.agents ?? [];
    expect(agents).toHaveLength(1);
    expect(agents[0]?.metadata ?? '').toBe('');
    expect(await storedConversations()).toBe(1);
  });

  it('dispatches no metadata for a User with no items', async () => {
    const { claims } = await requestRoomToken();

    expect(metadataOf(claims)).toBe('');
  });

  it("carries the User's brief as the dispatch metadata", async () => {
    await prisma.learnerItem.create({ data: phraseOf(signedIn.user.id) });

    const { claims } = await requestRoomToken();

    const metadata = metadataOf(claims);
    expect(learnerBriefSchema.parse(JSON.parse(metadata))).toEqual({
      version: 1,
      items: [
        {
          english: "I'd like to reschedule the meeting.",
          meaning: 'Tôi muốn dời cuộc họp.',
          status: 'learning',
        },
      ],
    });
  });

  it("never carries another User's items", async () => {
    const grace = await registerUser(app, 'grace@example.test');
    await prisma.learnerItem.create({ data: phraseOf(grace.user.id) });

    const { claims } = await requestRoomToken();

    expect(metadataOf(claims)).toBe('');
  });

  it('ignores client-supplied dispatch metadata', async () => {
    const { claims } = await requestRoomToken({
      room_config: { agents: [{ agent_name: 'x', metadata: 'evil' }] },
    });

    expect(metadataOf(claims)).toBe('');
  });

  it("sends the User's brief, not the client's metadata, to a User with items", async () => {
    await prisma.learnerItem.create({ data: phraseOf(signedIn.user.id) });

    const { claims } = await requestRoomToken({
      room_config: { agents: [{ agent_name: 'x', metadata: 'evil' }] },
    });

    // 'evil' is not JSON: the metadata parses only when it is the brief.
    const brief = learnerBriefSchema.parse(JSON.parse(metadataOf(claims)));
    expect(brief.items.map(({ english }) => english)).toEqual([
      "I'd like to reschedule the meeting.",
    ]);
  });

  it('still issues the Room Token when building the brief fails, and logs why', async () => {
    vi.spyOn(app.get(LearnerService), 'briefFor').mockRejectedValue(
      new Error('db'),
    );
    const warn = vi.spyOn(Logger.prototype, 'warn');

    const { claims } = await requestRoomToken();

    expect(agentNamesDispatchedBy(claims)).toEqual([testEnv.AGENT_NAME]);
    expect(metadataOf(claims)).toBe('');
    expect(warn).toHaveBeenCalledWith({
      message: 'Could not build the learner brief; dispatching without it',
      userId: signedIn.user.id,
      error: 'db',
    });
  });

  it('processes a missed Conversation at the next Room Token', async () => {
    await endedConversation(app, signedIn.user, {
      room: 'missed-room',
      at: day(0),
      notes: [
        {
          kind: 'phrase',
          english: "I'd like to reschedule the meeting.",
          meaning: 'Tôi muốn dời cuộc họp.',
          said: null,
        },
      ],
    });

    await requestRoomToken();

    await vi.waitFor(async () => {
      expect(await prisma.learnerItem.count()).toBe(1);
    });
  });

  it('rejects a body that is not in the standard token request shape', async () => {
    const response = await postRoomTokenRequest(
      { room_name: 42 },
      signedIn.authToken,
    );

    expect(response.status).toBe(400);
    expect(await storedConversations()).toBe(0);
  });
});
