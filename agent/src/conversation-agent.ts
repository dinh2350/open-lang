import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import { createSessionOptions, loadAgentConfig } from './config/index.ts';

/** The Agent: a general-purpose English assistant with no tools. */
const INSTRUCTIONS =
  'You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.';

const GREETING_INSTRUCTIONS =
  'Greet the user by saying exactly: "Hello, how can I help?"';

/**
 * Starts the Agent in a Conversation's session, joining the room if there is
 * one, and greets the User first, so they know it is listening. Without a
 * room, the session runs as in LiveKit's testing docs.
 */
export async function startConversation(
  session: voice.AgentSession,
  room?: Room,
): Promise<void> {
  // In a job, start() also connects to the room.
  await session.start({
    agent: new voice.Agent({ instructions: INSTRUCTIONS }),
    room,
  });
  // Greeting only once the room is connected: the Agent's state changes
  // before that never reach the User's browser.
  session.generateReply({ instructions: GREETING_INSTRUCTIONS });
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

    await startConversation(session, ctx.room);
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
