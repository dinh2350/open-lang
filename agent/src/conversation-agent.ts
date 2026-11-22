import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import {
  createSessionOptions,
  loadAgentConfig,
  modelsOf,
} from './config/index.ts';
import { ConversationAgent } from './agent.ts';

const GREETING_INSTRUCTIONS =
  'Greet the user by saying exactly: "Hello, how can I help?"';

/**
 * Starts a Conversation: the Agent joins the room, if there is one, in the
 * given AgentSession, and greets the User first, so they know it is
 * listening. Without a room, the AgentSession runs as in LiveKit's testing
 * docs.
 */
export async function startConversation(
  session: voice.AgentSession,
  room?: Room,
): Promise<void> {
  // In a job, start() also connects to the room.
  await session.start({
    agent: new ConversationAgent(),
    room,
  });
  // Greets only once the room is connected: the Agent's state changes
  // before that never reach the User's browser.
  session.generateReply({ instructions: GREETING_INSTRUCTIONS });
}

/**
 * The Agent's job: each dispatch into a Conversation's room runs that
 * Conversation in one AgentSession. The agent server loads this module in its
 * job processes.
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
    logger.info({ roomName, ...modelsOf(config) }, 'Conversation started');
  },
});
