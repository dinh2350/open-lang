import { initializeLogger, llm, voice } from '@livekit/agents';
import {
  type ConversationChoice,
  SCENARIOS,
  type ScenarioId,
  SPEEDS,
} from '@open-lang/shared';
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
  openingLine,
  scenarioInstructions,
} from '../src/scenario-instructions.ts';
import { firstAgentMessage } from './agent-messages.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY,
} from './fake-backend.ts';
import { dispatchToRoom } from './fake-job.ts';
import { startFakeRealtimeApi } from './fake-realtime-api.ts';
import { LiteralLLM } from './literal-llm.ts';

const pipelineWithFakes = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
  TTS_PROVIDER: 'fake',
};

const OPENING_LINES: readonly (readonly [ScenarioId, string])[] = [
  [
    'daily-standup',
    "Morning! Let's start the standup. What did you work on yesterday?",
  ],
  ['one-on-one', 'Hi, thanks for making time. How has your week been going?'],
  [
    'client-delay-call',
    'Hello, this is Jordan from the client team. I heard the delivery is delayed. What happened?',
  ],
];

const PACES = [
  [0.7, 'slowly and clearly'],
  [0.85, 'slightly slower than normal'],
  [1, 'at a normal pace'],
] as const;

function sessionWithLiteralLlm(): voice.AgentSession {
  initializeLogger({ pretty: false, level: 'error' });
  return new voice.AgentSession({
    ...createSessionOptions(loadAgentConfig(pipelineWithFakes), 1),
    llm: new LiteralLLM(),
  });
}

describe('Agent playing a Scenario, run with voice.testing', () => {
  it.each(OPENING_LINES)(
    'opens %s in role with its opening line',
    async (scenarioId, line) => {
      const session = sessionWithLiteralLlm();
      const greeting = firstAgentMessage(session);

      try {
        await startConversation(session, { scenarioId, speed: 1 });

        expect((await greeting).textContent).toBe(line);
        expect(openingLine(scenarioId)).toBe(line);
        expect(
          session.history.items
            .filter((item) => item instanceof llm.ChatMessage)
            .map(({ role }) => role),
        ).toEqual(['assistant']);
      } finally {
        await session.close();
      }
    },
  );

  it('the Agent session publishes no transcription to the room', async () => {
    const session = sessionWithLiteralLlm();
    const start = vi.spyOn(session, 'start');

    try {
      await startConversation(session, {
        scenarioId: 'daily-standup',
        speed: 1,
      });

      expect(start).toHaveBeenCalledWith(
        expect.objectContaining({
          outputOptions: { transcriptionEnabled: false },
        }),
      );
    } finally {
      await session.close();
    }
  });
});

/** The rule against correcting the User's English, word for word. */
const NO_CORRECTING_RULE =
  "Never comment on or correct the User's English (grammar, words, pronunciation); a report covers that later. Feedback on their work, in your role, is part of the role-play.";

/** Who each Scenario's persona is to the User. */
const ROLES: Readonly<Record<ScenarioId, string>> = {
  'daily-standup': "the lead of the User's daily standup",
  'one-on-one': "the User's manager",
  'client-delay-call': 'a client',
};

describe('The Scenario instructions', () => {
  it.each(
    SCENARIOS.flatMap((scenario) =>
      PACES.map((pace) => [scenario, pace] as const),
    ),
  )(
    'name the persona, the pace for each speed, and forbid correcting the User (%j)',
    ({ id, personaName }, [speed, pace]) => {
      const choice: ConversationChoice = { scenarioId: id, speed };

      const instructions = scenarioInstructions(choice);

      expect(instructions).toContain(`You are ${personaName}`);
      expect(instructions).toContain(`Speak ${pace}`);
      expect(instructions).toMatch(/only in English/i);
      expect(instructions).toContain(NO_CORRECTING_RULE);
      for (const [, otherPace] of PACES.filter(([s]) => s !== speed)) {
        expect(instructions).not.toContain(otherPace);
      }
    },
  );

  it.each(SCENARIOS)(
    'give the persona of $id its own role, and no contradicting one',
    ({ id, personaName }) => {
      const instructions = scenarioInstructions({ scenarioId: id, speed: 1 });

      expect(instructions).toContain(`You are ${personaName}, ${ROLES[id]},`);
      expect(instructions).toContain(
        'Talk the way a native speaker talks at work',
      );
      expect(instructions).not.toMatch(/real colleague/i);
      expect(instructions).not.toMatch(/only play your role/i);
    },
  );

  it.each(['one-on-one', 'client-delay-call'] as const)(
    'never call the persona of %s a colleague',
    (scenarioId) => {
      expect(scenarioInstructions({ scenarioId, speed: 1 })).not.toMatch(
        /colleague/i,
      );
    },
  );
});

describe('Agent dispatched with a Scenario', () => {
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

  it('a job dispatched with Scenario metadata starts that Scenario at that speed', async () => {
    const job = await dispatchToRoom(
      conversationAgent,
      'conversation-scenario',
      JSON.stringify({ scenarioId: 'one-on-one', speed: 0.7 }),
    );
    await job.end();

    expect(job.logs()).toContainEqual(
      expect.objectContaining({
        msg: 'Conversation started',
        roomName: 'conversation-scenario',
        scenarioId: 'one-on-one',
        speed: 0.7,
      }),
    );
  });

  it.each([
    ['no metadata', undefined],
    ['metadata that is not JSON', 'one-on-one'],
    [
      'an unknown Scenario',
      JSON.stringify({ scenarioId: 'job-interview', speed: 1 }),
    ],
  ])('a job with %s fails', async (_, metadata) => {
    await expect(
      dispatchToRoom(conversationAgent, 'conversation-bad', metadata),
    ).rejects.toThrow(/metadata|JSON|scenarioId/i);
  });
});

describe('OpenAI realtime options', () => {
  it.each(SPEEDS)('carry the chosen speed of %s', async (speed) => {
    initializeLogger({ pretty: false, level: 'error' });
    const realtimeApi = await startFakeRealtimeApi();
    // The plugin reads it when the model is built.
    vi.stubEnv('OPENAI_BASE_URL', `${realtimeApi.baseUrl}/v1`);
    try {
      const options = createSessionOptions(
        loadAgentConfig({
          AGENT_MODE: 'realtime',
          REALTIME_PROVIDER: 'openai',
          OPENAI_API_KEY: 'test-key',
        }),
        speed,
      );

      const connection = await realtimeApi.connect(options.llm);

      expect(connection.firstMessage).toHaveProperty(
        'session.audio.output.speed',
        speed,
      );
    } finally {
      vi.unstubAllEnvs();
      await realtimeApi.close();
    }
  });
});
