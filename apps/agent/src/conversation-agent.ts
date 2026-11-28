import {
  defineAgent,
  type JobContext,
  type llm,
  log,
  voice,
} from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import { type LearnerBrief, parseLearnerBrief } from '@open-lang/shared';
import {
  createSessionOptions,
  loadAgentConfig,
  modelsOf,
  noteOrderOf,
} from './config/index.ts';
import { TutorAgent } from './agent.ts';
import { loadBackendEnvironment } from './agent-environment.ts';
import { createBackendClient, trackPendingSends } from './backend-client.ts';
import { createSaveNoteTool } from './note-tool.ts';
import { type NoteOrder, OPENING_INSTRUCTIONS } from './tutor-instructions.ts';
import { recordTranscript } from './transcript-recorder.ts';

/**
 * Starts a Conversation: the tutor joins the room, if there is one, in the
 * given AgentSession, with the given tools, and opens with its opening line,
 * so the User knows it is listening. The tutor calls its tools in the given
 * order, after it speaks by default, and knows from the learner brief, if
 * there is one, what the User has already studied. Without a room, the
 * AgentSession runs as in LiveKit's testing docs. Text the User types is
 * handled as the SDK does by default.
 */
export async function startConversation(
  session: voice.AgentSession,
  options: {
    room?: Room;
    tools?: llm.ToolContextLike;
    noteOrder?: NoteOrder;
    brief?: LearnerBrief | null;
  } = {},
): Promise<void> {
  // In a job, start() also connects to the room.
  await session.start({
    agent: new TutorAgent(options.tools, options.noteOrder, options.brief),
    room: options.room,
  });
  // Greets only once the room is connected: the Agent's state changes
  // before that never reach the User's browser.
  session.generateReply({ instructions: OPENING_INSTRUCTIONS });
}

/** The session close reasons that mean the job is ending already. */
const JOB_ENDING_REASONS: ReadonlySet<string> = new Set([
  voice.CloseReason.JOB_SHUTDOWN,
]);

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
    // The job's metadata is read for the learner brief only. Without a valid
    // brief, or with one that has no items, the Conversation is the same
    // lesson as ever.
    const brief = parseLearnerBrief(ctx.job.metadata);
    const session = new voice.AgentSession(createSessionOptions(config));
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      logger.info({ roomName, reason: event.reason }, 'Conversation ended');
      // One session per job: once it closes (the User left, say), the job
      // ends now, so its shutdown callbacks post the end marker at once
      // instead of when the empty room times out.
      if (!JOB_ENDING_REASONS.has(event.reason)) {
        ctx.shutdown(event.reason);
      }
    });

    const backend = createBackendClient({
      backendUrl: BACKEND_URL,
      agentApiKey: AGENT_API_KEY,
    });
    // The Notes still being sent when the job ends are awaited before the
    // end marker.
    const pendingSends = trackPendingSends(backend);
    const noteOrder = noteOrderOf(config);
    // Without a room name, the Notes would belong to no Conversation.
    await startConversation(session, {
      room: ctx.room,
      tools: roomName
        ? [createSaveNoteTool({ backend: pendingSends.client, roomName })]
        : [],
      noteOrder,
      brief,
    });
    // Each turn goes to the backend as soon as it is in the history, so a
    // Conversation that ends abruptly keeps its transcript. The job process
    // exits after its shutdown callbacks, so the last sends are awaited
    // there, then the end marker tells the backend the Report may be
    // written. flush() is bounded and never rejects, nor do the sends, so
    // the marker is sent even when the flush gives up.
    if (roomName) {
      const recorder = recordTranscript(session, backend, roomName);
      ctx.addShutdownCallback(async () => {
        await Promise.all([recorder.flush(), pendingSends.settled()]);
        await backend.sendEnd(roomName);
      });
    }
    // Only how many items, never the items: they come from the User's Notes.
    logger.info(
      {
        roomName,
        ...modelsOf(config),
        noteOrder,
        briefItems: brief?.items.length ?? 0,
      },
      'Conversation started',
    );
  },
});
