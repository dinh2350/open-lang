import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import { createSessionOptions, loadAgentConfig } from './config/index.ts';

const INSTRUCTIONS =
  'You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.';

const GREETING_INSTRUCTIONS =
  'Greet the user by saying exactly: "Hello, how can I help?"';

/**
 * The Agent: a general-purpose English assistant with no tools. It speaks
 * first, so the User knows it has joined and is listening.
 */
export class ConversationAgent extends voice.Agent {
  constructor() {
    super({ instructions: INSTRUCTIONS });
  }

  override onEnter(): Promise<void> {
    this.session.generateReply({ instructions: GREETING_INSTRUCTIONS });
    return Promise.resolve();
  }
}

/**
 * The Agent's job: each dispatch into a Conversation's room runs one session
 * there. The agent server loads this module in its job processes.
 */
export default defineAgent({
  entry: async (ctx: JobContext) => {
    const logger = log();
    const roomName = ctx.job.room?.name;
    const config = loadAgentConfig(process.env);

    const session = new voice.AgentSession(createSessionOptions(config));
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      logger.info({ roomName, reason: event.reason }, 'Conversation ended');
    });

    await session.start({ agent: new ConversationAgent(), room: ctx.room });
    await ctx.connect();
    logger.info(
      {
        roomName,
        agentMode: config.agentMode,
        provider: config.realtime.provider,
        model: config.realtime.model,
      },
      'Conversation started',
    );
  },
});
