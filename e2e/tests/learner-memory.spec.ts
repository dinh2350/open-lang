import { randomUUID } from 'node:crypto';
import {
  authResponseSchema,
  learnerBriefSchema,
  parseLearnerBrief,
  roomTokenResponseSchema,
} from '@open-lang/shared';
import { expect, test } from '@playwright/test';
import {
  BACKEND_URL,
  dispatchMetadataOfToken,
  type PostedNote,
  postEnd,
  postNote,
  postTurn,
  roomNameOfToken,
  secondsAgo,
} from './agent-ingest.ts';
import { saveLog } from './evidence.ts';
import { randomClientAddress } from './users.ts';

/**
 * The profile is updated in the background, so the next Room Token may not
 * carry it at once. The Agent's end marker starts the update, and each Room
 * Token request also takes the User's Conversations that were not processed
 * yet, so the poll sees the item whichever of the two gets there first. These
 * tests do not tell the two apart: the end marker's own trigger is covered by
 * the backend's integration tests.
 */
const PROFILE_TIMEOUT = 15_000;

const PASSWORD = 'correct horse battery staple';

const RESCHEDULE: PostedNote = {
  kind: 'phrase',
  english: "I'd like to reschedule the meeting.",
  meaning: 'Tôi muốn dời cuộc họp.',
  said: null,
};

/** A User who registered, as the backend knows them. */
interface SignedInUser {
  /** Names the User in the log. */
  readonly label: string;
  readonly authToken: string;
}

/** What a Room Token tells a test: its room, and the brief it carries, if any. */
interface RoomTokenContent {
  readonly roomName: string;
  readonly metadata: string | undefined;
}

interface LoggedRequest {
  readonly scenario: string;
  readonly step: number;
  readonly action: string;
  readonly method: 'POST';
  readonly path: string;
  readonly detail?: object;
}

interface LoggedResponse {
  readonly scenario: string;
  readonly step: number;
  readonly status: number;
  readonly detail?: object;
}

// The evidence of the run: every step of every scenario and its outcome.
// Never a password, an Auth Token, a Room Token or the Agent key.
const requests: LoggedRequest[] = [];
const responses: LoggedResponse[] = [];

test.afterEach(async () => {
  await saveLog('learner-memory', { requests, responses });
});

/** Logs a request of the running scenario; gives its step number. */
function logRequest(action: string, path: string, detail?: object): number {
  const scenario = test.info().title;
  const step =
    requests.filter((logged) => logged.scenario === scenario).length + 1;
  requests.push({ scenario, step, action, method: 'POST', path, detail });
  return step;
}

function logResponse(step: number, status: number, detail?: object): void {
  responses.push({ scenario: test.info().title, step, status, detail });
}

/** Logs the answer of a request that did not succeed, and fails the test. */
async function failWith(
  step: number,
  what: string,
  response: Response,
): Promise<never> {
  const body = await response.text();
  logResponse(step, response.status, { body });
  throw new Error(`${what} answered ${String(response.status)}: ${body}`);
}

/** The brief as the log shows it: its items, or the metadata as it came. */
function briefForLog(metadata: string | undefined): unknown {
  return metadata === undefined
    ? null
    : (parseLearnerBrief(metadata) ?? metadata);
}

/**
 * Registers a new User through the backend. Each User registers from an
 * address of their own, so the limit of 5 registrations a minute per client
 * IP counts them apart (see users.ts).
 */
async function registerUser(label: string): Promise<SignedInUser> {
  const email = `e2e-${randomUUID()}@example.test`;
  const step = logRequest(`register the ${label}`, '/api/auth/register', {
    email,
  });
  const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': randomClientAddress(),
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (response.status !== 201) {
    return await failWith(step, 'POST /api/auth/register', response);
  }
  const { authToken, user } = authResponseSchema.parse(await response.json());
  logResponse(step, response.status, { userId: user.id, role: user.role });
  return { label, authToken };
}

/** Asks for a Room Token of a new Conversation, as the frontend does. */
async function requestRoomToken(user: SignedInUser): Promise<RoomTokenContent> {
  const step = logRequest(
    `ask the ${user.label} for a Room Token`,
    '/api/token',
  );
  const response = await fetch(`${BACKEND_URL}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.authToken}`,
      'Content-Type': 'application/json',
    },
    // The backend reads nothing of the request, but it must be an object.
    body: '{}',
  });
  if (response.status !== 201) {
    return await failWith(step, 'POST /api/token', response);
  }
  const { participant_token: roomToken } = roomTokenResponseSchema.parse(
    await response.json(),
  );
  const content = {
    roomName: roomNameOfToken(roomToken),
    metadata: dispatchMetadataOfToken(roomToken),
  };
  logResponse(step, response.status, {
    roomName: content.roomName,
    brief: briefForLog(content.metadata),
  });
  return content;
}

/** Runs one report of the Agent to the backend, and logs it and its answer. */
async function reportAsAgent(
  action: string,
  path: string,
  send: () => Promise<void>,
): Promise<void> {
  const step = logRequest(action, path);
  // The helpers throw unless the backend answers 204.
  await send();
  logResponse(step, 204);
}

/**
 * A User's Conversation, from the Room Token to the end marker, as the Agent
 * reports it: a turn of each side and one Note.
 */
async function finishConversationWith(
  user: SignedInUser,
  note: PostedNote,
): Promise<void> {
  const { roomName } = await requestRoomToken(user);
  const conversation = `/api/agent/conversations/${roomName}`;
  await reportAsAgent(
    `the tutor speaks to the ${user.label}`,
    `${conversation}/turns`,
    () =>
      postTurn(roomName, {
        role: 'agent',
        text: `Try saying: ${note.english}`,
        startedAt: secondsAgo(6),
        endedAt: secondsAgo(4),
      }),
  );
  await reportAsAgent(
    `the ${user.label} answers`,
    `${conversation}/turns`,
    () =>
      postTurn(roomName, {
        role: 'user',
        text: note.english,
        startedAt: secondsAgo(3),
        endedAt: secondsAgo(1),
      }),
  );
  await reportAsAgent(
    `the tutor saves a ${note.kind} Note`,
    `${conversation}/notes`,
    () => postNote(roomName, note),
  );
  await reportAsAgent(
    'the Agent posts the end marker',
    `${conversation}/end`,
    () => postEnd(roomName),
  );
}

/**
 * Asks the User for Room Tokens until one carries a brief, and gives its
 * metadata. The profile is written in the background, started by the end
 * marker or by a Room Token request, so the first tokens may not carry it.
 */
async function metadataOfFirstBrief(user: SignedInUser): Promise<string> {
  const asked: (string | undefined)[] = [];
  await expect
    .poll(
      async () => {
        const { metadata } = await requestRoomToken(user);
        asked.push(metadata);
        return metadata;
      },
      {
        message: `a Room Token of the ${user.label} that carries the brief`,
        timeout: PROFILE_TIMEOUT,
      },
    )
    .toBeDefined();
  const metadata = asked.at(-1);
  if (metadata === undefined) {
    throw new Error('The poll ended without a Room Token that has metadata.');
  }
  return metadata;
}

test("a new User's Room Token carries no metadata", async () => {
  const user = await registerUser('User');

  const { metadata } = await requestRoomToken(user);

  expect(metadata).toBeUndefined();
});

test('a finished Conversation leaves items that the next Room Token carries', async () => {
  const user = await registerUser('User');

  await finishConversationWith(user, RESCHEDULE);

  const metadata = await metadataOfFirstBrief(user);

  const brief = learnerBriefSchema.parse(JSON.parse(metadata));
  expect(brief.items).toEqual([
    {
      english: RESCHEDULE.english,
      meaning: RESCHEDULE.meaning,
      status: 'learning',
    },
  ]);
});

test("a second User's Room Token carries none of the first User's items", async () => {
  const first = await registerUser('first User');
  await finishConversationWith(first, RESCHEDULE);
  // The first User's profile now holds the item: the Room Token carries it.
  const metadata = await metadataOfFirstBrief(first);
  expect(learnerBriefSchema.parse(JSON.parse(metadata)).items).toHaveLength(1);

  const second = await registerUser('second User');
  const { metadata: secondMetadata } = await requestRoomToken(second);

  expect(secondMetadata).toBeUndefined();
});
