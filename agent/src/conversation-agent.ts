import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import { fakeProviderSessionOptions } from './fake-provider.ts';

const INSTRUCTIONS =
  'You are a helpful general-purpose voice assistant. Answer in English, briefly and clearly.';

/**
 * The Agent's job: each dispatch into a Conversation's room runs one session
 * there. The agent server loads this module in its job processes.
 */
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
