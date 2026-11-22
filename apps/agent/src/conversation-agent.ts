import { defineAgent, type JobContext, log, voice } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import type { ConversationChoice } from '@open-lang/shared';
import {
  createSessionOptions,
  loadAgentConfig,
  modelsOf,
} from './config/index.ts';
import { ConversationAgent } from './agent.ts';
import { loadBackendEnvironment } from './agent-environment.ts';
import { createBackendClient } from './backend-client.ts';
import { readConversationChoice } from './conversation-choice.ts';
import { createListeningHelpHandler } from './listening-help.ts';
import { greetingInstructions } from './scenario-instructions.ts';
import { recordTranscript } from './transcript-recorder.ts';

/**
 * Starts a Conversation: the Agent joins the room, if there is one, in the
 * given AgentSession, plays the chosen Scenario, and opens it with its
 * opening line, so the User knows it is listening. Without a room, the
 * AgentSession runs as in LiveKit's testing docs. `extras.textInputCallback`
 * replaces what happens when the User types a message in the room.
 */
export async function startConversation(
  session: voice.AgentSession,
  choice: ConversationChoice,
  room?: Room,
  extras: { textInputCallback?: voice.TextInputCallback } = {},
): Promise<void> {
  // In a job, start() also connects to the room.
  await session.start({
    agent: new ConversationAgent(choice),
    room,
    // Left out, the SDK's default applies. An undefined value would replace it.
    ...(extras.textInputCallback && {
      inputOptions: { textInputCallback: extras.textInputCallback },
    }),
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
    const { BACKEND_URL, AGENT_API_KEY } = loadBackendEnvironment(process.env);
    const choice = readConversationChoice(ctx.job.metadata);

    const session = new voice.AgentSession(
      createSessionOptions(config, choice.speed),
    );
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      logger.info({ roomName, reason: event.reason }, 'Conversation ended');
    });

    const backend = createBackendClient({
      backendUrl: BACKEND_URL,
      agentApiKey: AGENT_API_KEY,
    });
    // "Chưa nghe kịp" reaches the Agent as a typed message in the room, and
    // is recorded as a Miss of this room's Conversation.
    await startConversation(
      session,
      choice,
      ctx.room,
      roomName
        ? {
            textInputCallback: createListeningHelpHandler({
              backend,
              roomName,
            }),
          }
        : {},
    );
    // Each turn goes to the backend as soon as it is in the history, so a
    // Conversation that ends abruptly keeps its transcript. The job process
    // exits after its shutdown callbacks, so the last sends are awaited
    // there; flush() is bounded and never rejects.
    if (roomName) {
      const recorder = recordTranscript(session, backend, roomName);
      ctx.addShutdownCallback(() => recorder.flush());
    }
    logger.info(
      { roomName, ...choice, ...modelsOf(config) },
      'Conversation started',
    );
  },
});
