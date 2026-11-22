import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import type { ConversationChoice } from '@open-lang/shared';
import {
  createSessionOptions,
  loadAgentConfig,
  modelsOf,
} from './config/index.ts';
import { ConversationAgent } from './agent.ts';
import { readConversationChoice } from './conversation-choice.ts';
import { greetingInstructions } from './scenario-instructions.ts';

/**
 * Starts a Conversation: the Agent joins the room, if there is one, in the
 * given AgentSession, plays the chosen Scenario, and opens it with its
 * opening line, so the User knows it is listening. Without a room, the
 * AgentSession runs as in LiveKit's testing docs.
 */
export async function startConversation(
  session: voice.AgentSession,
  choice: ConversationChoice,
  room?: Room,
): Promise<void> {
  // In a job, start() also connects to the room.
  await session.start({
    agent: new ConversationAgent(choice),
    room,
    // The browser shows no text of the Conversation: it is all audio.
    outputOptions: { transcriptionEnabled: false },
  });
  // Greets only once the room is connected: the Agent's state changes
  // before that never reach the User's browser.
  session.generateReply({
    instructions: greetingInstructions(choice.scenarioId),
  });
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
    const choice = readConversationChoice(ctx.job.metadata);

    const session = new voice.AgentSession(
      createSessionOptions(config, choice.speed),
    );
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      logger.info({ roomName, reason: event.reason }, 'Conversation ended');
    });

    await startConversation(session, choice, ctx.room);
    logger.info(
      { roomName, ...choice, ...modelsOf(config) },
      'Conversation started',
    );
  },
});
