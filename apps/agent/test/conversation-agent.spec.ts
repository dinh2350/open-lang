import { llm, voice } from '@livekit/agents';
import { LISTENING_HELP_MESSAGE } from '@open-lang/shared';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import conversationAgent from '../src/conversation-agent.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY,
} from './fake-backend.ts';
import { dispatchToRoom } from './fake-job.ts';

/** What the backend sets as the job's metadata. */
const standupAtNormalSpeed = JSON.stringify({
  scenarioId: 'daily-standup',
  speed: 1,
});

describe('Agent dispatched into a Conversation room', () => {
  let backend: FakeBackend;

  beforeAll(async () => {
    backend = await startFakeBackend();
  });

  afterAll(async () => {
    await backend.close();
  });

  beforeEach(() => {
    vi.stubEnv('AGENT_MODE', 'realtime');
    vi.stubEnv('REALTIME_PROVIDER', 'fake');
    vi.stubEnv('BACKEND_URL', backend.url);
    vi.stubEnv('AGENT_API_KEY', TEST_AGENT_API_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('joins the room and logs that the Conversation started, with the room name', async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-123',
      standupAtNormalSpeed,
    );
    await job.end();

    expect(job.joinedRoom()).toBe(true);
    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        roomName: 'conversation-123',
      }),
    );
  });

  it('logs its Agent Mode, Provider and model when the Conversation starts', async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-789',
      standupAtNormalSpeed,
    );
    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        agentMode: 'realtime',
        provider: 'fake',
        model: 'fake-llm',
      }),
    );
  });

  it('logs each step of Pipeline mode with its Provider and model when the Conversation starts', async () => {
    vi.stubEnv('AGENT_MODE', 'pipeline');
    vi.stubEnv('STT_PROVIDER', 'fake');
    vi.stubEnv('LLM_PROVIDER', 'fake');
    vi.stubEnv('TTS_PROVIDER', 'fake');

    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-321',
      standupAtNormalSpeed,
    );
    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        roomName: 'conversation-321',
        agentMode: 'pipeline',
        stt: { provider: 'fake', model: 'none' },
        llm: { provider: 'fake', model: 'fake-llm' },
        tts: { provider: 'fake', model: 'none' },
      }),
    );
  });

  it('logs that the Conversation ended, with the room name and the reason, when its job ends', async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-456',
      standupAtNormalSpeed,
    );

    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation ended',
        roomName: 'conversation-456',
        reason: 'job_shutdown',
      }),
    );
  });

  it("sends each turn of the Conversation to the backend, under the room's name", async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-transcript',
      standupAtNormalSpeed,
    );
    job.session()?.emit(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      voice.createConversationItemAddedEvent(
        llm.ChatMessage.create({
          id: 'item_answer',
          role: 'user',
          content: 'I fixed the login bug.',
        }),
      ),
    );

    const request = await vi.waitFor(() => {
      const found = backend.requests.find(
        ({ url }) =>
          url === '/api/agent/conversations/conversation-transcript/turns',
      );
      expect(found).toBeDefined();
      return found;
    });
    expect(request).toMatchObject({
      authorization: `Bearer ${TEST_AGENT_API_KEY}`,
      body: {
        itemId: 'item_answer',
        role: 'user',
        text: 'I fixed the login bug.',
      },
    });
    await job.end();
  });

  it('sends the turns still queued when the job ends before it exits', async () => {
    const slowBackend = await startFakeBackend([], { responseDelayMs: 1000 });
    vi.stubEnv('BACKEND_URL', slowBackend.url);
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-ending',
        standupAtNormalSpeed,
      );
      for (const id of ['item_first', 'item_last']) {
        job
          .session()
          ?.emit(
            voice.AgentSessionEventTypes.ConversationItemAdded,
            voice.createConversationItemAddedEvent(
              llm.ChatMessage.create({ id, role: 'user', content: 'Bye.' }),
            ),
          );
      }

      await job.end();

      // The queue posts one turn at a time: the last is sent only after the
      // slow answer to the first.
      expect(
        slowBackend.requests
          .filter(({ url }) => url?.endsWith('/turns'))
          .map(({ body }) => (body as { itemId: string }).itemId),
      ).toEqual(['item_first', 'item_last']);
    } finally {
      await slowBackend.close();
    }
  });

  it.each(['BACKEND_URL', 'AGENT_API_KEY'])(
    'a job fails, naming %s, when it is missing',
    async (name) => {
      vi.stubEnv(name, undefined);

      await expect(
        dispatchToRoom(
          conversationAgent,
          'conversation-unconfigured',
          standupAtNormalSpeed,
        ),
      ).rejects.toThrow(new RegExp(name));
    },
  );

  /** Spies on AgentSession.start, which still runs, to see the options the job passes. */
  function spyOnSessionStart() {
    return vi.spyOn(voice.AgentSession.prototype, 'start');
  }

  /** The text input handler the job started its session with, if any. */
  function textInputCallbackOf(
    start: ReturnType<typeof spyOnSessionStart>,
  ): voice.TextInputCallback | undefined {
    return start.mock.calls[0]?.[0].inputOptions?.textInputCallback;
  }

  /** Emits a User message the session added to its history. */
  function addUserMessage(session: voice.AgentSession | undefined, id: string) {
    session?.emit(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      voice.createConversationItemAddedEvent(
        llm.ChatMessage.create({ id, role: 'user', content: 'Bye.' }),
      ),
    );
  }

  it('the job posts the end marker after the transcript flush', async () => {
    const slowBackend = await startFakeBackend([], { responseDelayMs: 300 });
    vi.stubEnv('BACKEND_URL', slowBackend.url);
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-end',
        standupAtNormalSpeed,
      );
      addUserMessage(job.session(), 'item_first');
      addUserMessage(job.session(), 'item_last');

      await job.end();

      const turns = '/api/agent/conversations/conversation-end/turns';
      expect(slowBackend.events).toEqual([
        `received ${turns}`,
        `answered ${turns}`,
        `received ${turns}`,
        `answered ${turns}`,
        'received /api/agent/conversations/conversation-end/end',
        'answered /api/agent/conversations/conversation-end/end',
      ]);
    } finally {
      await slowBackend.close();
    }
  });

  it('the job starts its session with the listening help handler, which records a Miss for its room', async () => {
    const start = spyOnSessionStart();
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-help-press',
        standupAtNormalSpeed,
      );
      const session = job.session();
      const textInputCallback = textInputCallbackOf(start);

      expect(textInputCallback).toBeTypeOf('function');
      if (session === undefined || textInputCallback === undefined) return;
      await textInputCallback(session, { text: LISTENING_HELP_MESSAGE });

      await vi.waitFor(() => {
        expect(backend.requests).toContainEqual(
          expect.objectContaining({
            url: '/api/agent/conversations/conversation-help-press/misses',
            body: { pressedAt: expect.any(String) as unknown },
          }),
        );
      });
      await job.end();
    } finally {
      start.mockRestore();
    }
  });

  it('the job posts the end marker only after a Miss that is still being sent', async () => {
    const slowBackend = await startFakeBackend([], { responseDelayMs: 300 });
    vi.stubEnv('BACKEND_URL', slowBackend.url);
    const start = spyOnSessionStart();
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-late-press',
        standupAtNormalSpeed,
      );
      const session = job.session();
      const textInputCallback = textInputCallbackOf(start);
      if (session === undefined || textInputCallback === undefined) {
        throw new Error('The job started no session with a text handler.');
      }
      await textInputCallback(session, { text: LISTENING_HELP_MESSAGE });

      await job.end();

      const misses = '/api/agent/conversations/conversation-late-press/misses';
      const end = '/api/agent/conversations/conversation-late-press/end';
      expect(slowBackend.events).toEqual([
        `received ${misses}`,
        `answered ${misses}`,
        `received ${end}`,
        `answered ${end}`,
      ]);
    } finally {
      start.mockRestore();
      await slowBackend.close();
    }
  });

  it('a job without a room name keeps the SDK default text input and sends nothing', async () => {
    const start = spyOnSessionStart();
    const requestsBefore = backend.requests.length;
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        '',
        standupAtNormalSpeed,
      );
      await job.end();

      expect(start).toHaveBeenCalledTimes(1);
      expect(start.mock.calls[0]?.[0].inputOptions).toBeUndefined();
      expect(backend.requests.slice(requestsBefore)).toEqual([]);
    } finally {
      start.mockRestore();
    }
  });
});
