import { fileURLToPath } from 'node:url';
import {
  cli,
  defineAgent,
  type JobContext,
  log,
  ServerOptions,
  voice,
} from '@livekit/agents';
import { loadAgentEnvironment } from './agent-environment.ts';
import { fakeProviderSessionOptions } from './fake-provider.ts';

// Node's watch mode (the `dev` script) sets this variable. The Agent's job and
// inference processes would inherit it and send Node's dependency reports over
// the framework's IPC channel, which makes the agent server fail at startup.
delete process.env.WATCH_REPORT_DEPENDENCIES;

const INSTRUCTIONS =
  'You are a helpful general-purpose voice assistant. Answer in English, briefly and clearly.';

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();
    const roomName = ctx.job.room?.name;

    const session = new voice.AgentSession(fakeProviderSessionOptions());
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      logger.info({ roomName, reason: event.reason }, 'Conversation ended');
    });

    await session.start({
      agent: new voice.Agent({ instructions: INSTRUCTIONS }),
      room: ctx.room,
    });
    await ctx.connect();
    logger.info({ roomName }, 'Conversation started');
  },
});

// Job processes import this file too; the CLI only starts the agent server
// in the main process.
const { AGENT_NAME } = loadAgentEnvironment(process.env);
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: AGENT_NAME,
  }),
);
