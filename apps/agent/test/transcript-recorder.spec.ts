import { initializeLogger, llm, voice } from '@livekit/agents';
import type { TurnIngest } from '@open-lang/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendClient } from '../src/backend-client.ts';
import { recordTranscript } from '../src/transcript-recorder.ts';

const ROOM = 'conversation-123';
/** 2026-11-23T09:00:00.000Z, in milliseconds since the epoch, as LiveKit's Node.js events give it. */
const T0 = Date.UTC(2026, 10, 23, 9, 0, 0);

/** A BackendClient that records each turn it is sent. */
function stubBackend(
  sendTurn: (turn: TurnIngest) => Promise<void> = () => Promise.resolve(),
) {
  const turns: TurnIngest[] = [];
  const backend: BackendClient = {
    sendTurn: vi.fn((roomName: string, turn: TurnIngest) => {
      expect(roomName).toBe(ROOM);
      turns.push(turn);
      return sendTurn(turn);
    }),
    sendMiss: vi.fn(() => Promise.resolve()),
  };
  return { backend, turns };
}

function recordedSession(backend: BackendClient): voice.AgentSession {
  const session = new voice.AgentSession();
  recordTranscript(session, backend, ROOM);
  return session;
}

function addMessage(
  session: voice.AgentSession,
  message: {
    id: string;
    role: llm.ChatRole;
    content: string | string[];
    createdAt: number;
  },
) {
  session.emit(
    voice.AgentSessionEventTypes.ConversationItemAdded,
    voice.createConversationItemAddedEvent(llm.ChatMessage.create(message)),
  );
}

function userState(
  session: voice.AgentSession,
  oldState: voice.UserState,
  newState: voice.UserState,
  at: number,
) {
  session.emit(
    voice.AgentSessionEventTypes.UserStateChanged,
    voice.createUserStateChangedEvent(oldState, newState, at),
  );
}

function agentState(
  session: voice.AgentSession,
  oldState: voice.AgentState,
  newState: voice.AgentState,
  at: number,
) {
  session.emit(
    voice.AgentSessionEventTypes.AgentStateChanged,
    voice.createAgentStateChangedEvent(oldState, newState, at),
  );
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Lets every queued send run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('Transcript recorder', () => {
  beforeEach(() => {
    initializeLogger({ pretty: false, level: 'error' });
  });

  it('sends each user and assistant message once, in order, with its itemId', async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    addMessage(session, {
      id: 'item_greeting',
      role: 'assistant',
      content: 'Morning! What did you work on yesterday?',
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_answer',
      role: 'user',
      content: 'I fixed the login bug.',
      createdAt: T0 + 5000,
    });
    addMessage(session, {
      id: 'item_follow_up',
      role: 'assistant',
      content: 'Nice. Anything blocking you?',
      createdAt: T0 + 9000,
    });
    await settle();

    expect(
      turns.map(({ itemId, role, text }) => ({ itemId, role, text })),
    ).toEqual([
      {
        itemId: 'item_greeting',
        role: 'agent',
        text: 'Morning! What did you work on yesterday?',
      },
      { itemId: 'item_answer', role: 'user', text: 'I fixed the login bug.' },
      {
        itemId: 'item_follow_up',
        role: 'agent',
        text: 'Nice. Anything blocking you?',
      },
    ]);
  });

  it('skips items that are not messages and messages without text', async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    session.emit(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      voice.createConversationItemAddedEvent(
        llm.AgentHandoffItem.create({ newAgentId: 'conversation-agent' }),
      ),
    );
    addMessage(session, {
      id: 'item_system',
      role: 'system',
      content: 'You are Sam.',
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_empty',
      role: 'assistant',
      content: [],
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_blank',
      role: 'user',
      content: '   ',
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_real',
      role: 'user',
      content: 'Hello.',
      createdAt: T0,
    });
    await settle();

    expect(turns.map(({ itemId }) => itemId)).toEqual(['item_real']);
  });

  it("takes a User turn's start and end from the matching speaking interval", async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    userState(session, 'listening', 'speaking', T0 + 1000);
    userState(session, 'speaking', 'listening', T0 + 4250);
    // The transcript arrives after the User stopped speaking.
    addMessage(session, {
      id: 'item_answer',
      role: 'user',
      content: 'I fixed the login bug.',
      createdAt: T0 + 6000,
    });
    await settle();

    expect(turns).toEqual([
      {
        itemId: 'item_answer',
        role: 'user',
        text: 'I fixed the login bug.',
        startedAt: iso(T0 + 1000),
        endedAt: iso(T0 + 4250),
      },
    ]);
  });

  it("converts the millisecond createdAt of LiveKit's events to ISO times", async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    userState(session, 'listening', 'speaking', T0 + 1000);
    userState(session, 'speaking', 'listening', T0 + 4250);
    addMessage(session, {
      id: 'item_answer',
      role: 'user',
      content: 'I fixed the login bug.',
      createdAt: T0 + 6000,
    });
    await settle();

    expect(turns[0]).toMatchObject({
      startedAt: '2026-11-23T09:00:01.000Z',
      endedAt: '2026-11-23T09:00:04.250Z',
    });
  });

  it('pairs two Agent turns with their intervals first in, first out', async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    agentState(session, 'thinking', 'speaking', T0);
    agentState(session, 'speaking', 'listening', T0 + 2000);
    agentState(session, 'thinking', 'speaking', T0 + 3000);
    agentState(session, 'speaking', 'idle', T0 + 5500);
    addMessage(session, {
      id: 'item_first',
      role: 'assistant',
      content: 'First.',
      createdAt: T0 + 6000,
    });
    addMessage(session, {
      id: 'item_second',
      role: 'assistant',
      content: 'Second.',
      createdAt: T0 + 6001,
    });
    await settle();

    expect(
      turns.map(({ itemId, startedAt, endedAt }) => ({
        itemId,
        startedAt,
        endedAt,
      })),
    ).toEqual([
      {
        itemId: 'item_first',
        startedAt: iso(T0),
        endedAt: iso(T0 + 2000),
      },
      {
        itemId: 'item_second',
        startedAt: iso(T0 + 3000),
        endedAt: iso(T0 + 5500),
      },
    ]);
  });

  it('omits endedAt while no interval has closed', async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    // No speaking interval at all: the message's own time is its start.
    addMessage(session, {
      id: 'item_typed',
      role: 'user',
      content: 'Sorry, I typed this.',
      createdAt: T0 + 700,
    });
    // The Agent's message arrives while it is still speaking.
    agentState(session, 'thinking', 'speaking', T0 + 1000);
    addMessage(session, {
      id: 'item_spoken',
      role: 'assistant',
      content: 'Sure.',
      createdAt: T0 + 2000,
    });
    await settle();

    expect(turns).toEqual([
      {
        itemId: 'item_typed',
        role: 'user',
        text: 'Sorry, I typed this.',
        startedAt: iso(T0 + 700),
      },
      {
        itemId: 'item_spoken',
        role: 'agent',
        text: 'Sure.',
        startedAt: iso(T0 + 1000),
      },
    ]);
  });

  it('sends the turn again with its endedAt once its speaking interval closes', async () => {
    const { backend, turns } = stubBackend();
    const session = recordedSession(backend);

    agentState(session, 'thinking', 'speaking', T0 + 1000);
    addMessage(session, {
      id: 'item_spoken',
      role: 'assistant',
      content: 'Sure.',
      createdAt: T0 + 2000,
    });
    agentState(session, 'speaking', 'listening', T0 + 2100);
    await settle();

    expect(turns).toEqual([
      {
        itemId: 'item_spoken',
        role: 'agent',
        text: 'Sure.',
        startedAt: iso(T0 + 1000),
      },
      {
        itemId: 'item_spoken',
        role: 'agent',
        text: 'Sure.',
        startedAt: iso(T0 + 1000),
        endedAt: iso(T0 + 2100),
      },
    ]);
  });

  it('keeps sending when one send is slow', async () => {
    let finishSlowSend: (() => void) | undefined;
    const { backend, turns } = stubBackend((turn) =>
      turn.itemId === 'item_slow'
        ? new Promise<void>((resolve) => {
            finishSlowSend = resolve;
          })
        : Promise.resolve(),
    );
    const session = recordedSession(backend);

    addMessage(session, {
      id: 'item_slow',
      role: 'assistant',
      content: 'One.',
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_next',
      role: 'user',
      content: 'Two.',
      createdAt: T0 + 1000,
    });
    addMessage(session, {
      id: 'item_last',
      role: 'assistant',
      content: 'Three.',
      createdAt: T0 + 2000,
    });
    await settle();
    // The queue holds the next sends until the slow one has finished.
    expect(turns.map(({ itemId }) => itemId)).toEqual(['item_slow']);

    finishSlowSend?.();
    await settle();

    expect(turns.map(({ itemId }) => itemId)).toEqual([
      'item_slow',
      'item_next',
      'item_last',
    ]);
  });

  it('keeps sending after a send fails', async () => {
    const { backend, turns } = stubBackend((turn) =>
      turn.itemId === 'item_failing'
        ? Promise.reject(new Error('backend down'))
        : Promise.resolve(),
    );
    const session = recordedSession(backend);

    addMessage(session, {
      id: 'item_failing',
      role: 'assistant',
      content: 'One.',
      createdAt: T0,
    });
    addMessage(session, {
      id: 'item_next',
      role: 'user',
      content: 'Two.',
      createdAt: T0 + 1000,
    });
    await settle();

    expect(turns.map(({ itemId }) => itemId)).toEqual([
      'item_failing',
      'item_next',
    ]);
  });
});
