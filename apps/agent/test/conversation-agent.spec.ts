import { initializeLogger, llm, voice } from '@livekit/agents';
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
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import conversationAgent, {
  startConversation,
} from '../src/conversation-agent.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY,
} from './fake-backend.ts';
import { dispatchToRoom } from './fake-job.ts';

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
    const job = await dispatchToRoom(conversationAgent, 'conversation-123');
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
    const job = await dispatchToRoom(conversationAgent, 'conversation-789');
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

    const job = await dispatchToRoom(conversationAgent, 'conversation-321');
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
    const job = await dispatchToRoom(conversationAgent, 'conversation-456');

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
        dispatchToRoom(conversationAgent, 'conversation-unconfigured'),
      ).rejects.toThrow(new RegExp(name));
    },
  );

  /** Spies on AgentSession.start, which still runs, to see the options the job passes. */
  function spyOnSessionStart() {
    return vi.spyOn(voice.AgentSession.prototype, 'start');
  }

  /**
   * Scripts the fake Provider's model, which the job's session uses: each
   * input gets its response, any other input nothing, as FakeLLM does.
   */
  function scriptFakeModel(responses: voice.testing.FakeLLMResponse[]) {
    return vi
      .spyOn(voice.testing.FakeLLM.prototype, 'lookup')
      .mockImplementation((input) =>
        responses.find((response) => response.input === input),
      );
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
      const job = await dispatchToRoom(conversationAgent, 'conversation-end');
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

  it('the Agent publishes its transcription', async () => {
    const start = spyOnSessionStart();
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-transcription',
      );
      await job.end();

      expect(start).toHaveBeenCalledTimes(1);
      expect(
        start.mock.calls[0]?.[0].outputOptions?.transcriptionEnabled,
      ).not.toBe(false);
    } finally {
      start.mockRestore();
    }
  });

  it('the job runs with empty metadata', async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-no-metadata',
      '',
    );
    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        roomName: 'conversation-no-metadata',
      }),
    );
  });

  it('waits for a note still being sent before the end marker', async () => {
    const slowBackend = await startFakeBackend([], { responseDelayMs: 300 });
    vi.stubEnv('BACKEND_URL', slowBackend.url);
    const lookup = scriptFakeModel([
      {
        input: 'ghi lại câu này',
        toolCalls: [
          {
            name: 'saveNote',
            args: {
              kind: 'phrase',
              english: 'Yesterday I finished the login page.',
              meaning: 'Hôm qua tôi đã làm xong trang đăng nhập.',
              said: null,
            },
          },
        ],
      },
    ]);
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-late-note',
      );
      job.session()?.generateReply({ userInput: 'ghi lại câu này' });
      const notes = '/api/agent/conversations/conversation-late-note/notes';
      await vi.waitFor(() => {
        expect(slowBackend.events).toContain(`received ${notes}`);
      });

      await job.end();

      const end = '/api/agent/conversations/conversation-late-note/end';
      expect(
        slowBackend.events.filter((event) => !event.endsWith('/turns')),
      ).toEqual([
        `received ${notes}`,
        `answered ${notes}`,
        `received ${end}`,
        `answered ${end}`,
      ]);
    } finally {
      lookup.mockRestore();
      await slowBackend.close();
    }
  });

  it('typed listening-help text reaches the job as a User message and records no Miss', async () => {
    const start = spyOnSessionStart();
    try {
      const job = await dispatchToRoom(
        conversationAgent,
        'conversation-help-text',
      );
      const session = job.session();
      if (session === undefined) throw new Error('The job started no session.');
      // What RoomIO calls for a typed message: the job's own handler, if it
      // registered one, else the SDK's default.
      const textInputCallback =
        start.mock.calls[0]?.[0].inputOptions?.textInputCallback ??
        voice.DEFAULT_TEXT_INPUT_CALLBACK;

      await textInputCallback(session, { text: 'listening-help' });
      await vi.waitFor(() => {
        expect(
          session.history.items
            .filter((item) => item instanceof llm.ChatMessage)
            .filter(({ role }) => role === 'user')
            .map(({ textContent }) => textContent),
        ).toEqual(['listening-help']);
      });
      await job.end();

      expect(
        backend.requests.filter(({ url }) => url?.endsWith('/misses')),
      ).toEqual([]);
    } finally {
      start.mockRestore();
    }
  });

  it('a job without a room name keeps the SDK default text input and sends nothing', async () => {
    const start = spyOnSessionStart();
    const requestsBefore = backend.requests.length;
    try {
      const job = await dispatchToRoom(conversationAgent, '');
      await job.end();

      expect(start).toHaveBeenCalledTimes(1);
      expect(start.mock.calls[0]?.[0].inputOptions).toBeUndefined();
      expect(backend.requests.slice(requestsBefore)).toEqual([]);
    } finally {
      start.mockRestore();
    }
  });

  it('the job shuts down as soon as its session closes, so the end marker is not held up', async () => {
    const job = await dispatchToRoom(conversationAgent, 'conversation-left');
    const session = job.session();
    const closed = new Promise((resolve) => {
      session?.once(voice.AgentSessionEventTypes.Close, resolve);
    });

    // As RoomIO does when the User leaves the room.
    session?.shutdown({ reason: voice.CloseReason.PARTICIPANT_DISCONNECTED });
    await closed;

    // The session is closed already, so job.end() would wait for a second Close.
    expect(job.shutdownReasons()).toEqual(['participant_disconnected']);
  });
});

describe('The tutor, run with voice.testing', () => {
  it('the Agent no longer handles listening-help text', async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const session = new voice.AgentSession({
      ...createSessionOptions(
        loadAgentConfig({
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'fake',
          TTS_PROVIDER: 'fake',
        }),
      ),
      llm: new voice.testing.FakeLLM([
        { input: 'listening-help', content: 'Bạn cần mình giúp gì?' },
      ]),
    });
    try {
      await startConversation(session);

      // The SDK's default text input handler, which the job keeps: the text
      // is answered as the User's own message.
      await voice.DEFAULT_TEXT_INPUT_CALLBACK(session, {
        text: 'listening-help',
      });

      await vi.waitFor(() => {
        expect(
          session.history.items
            .filter((item) => item instanceof llm.ChatMessage)
            .filter(({ role }) => role !== 'system')
            .map(({ role, textContent }) => [role, textContent]),
        ).toEqual([
          ['user', 'listening-help'],
          ['assistant', 'Bạn cần mình giúp gì?'],
        ]);
      });
    } finally {
      await session.close();
    }
  });
});
