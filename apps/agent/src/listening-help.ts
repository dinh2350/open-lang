import type { voice } from '@livekit/agents';
import { LISTENING_HELP_MESSAGE } from '@open-lang/shared';
import type { BackendClient } from './backend-client.ts';

/**
 * What the model is told when the User presses "Chưa nghe kịp". It is an
 * instruction, not a User message: it never enters the history as something
 * the User said.
 */
const REPHRASE_INSTRUCTION =
  'The User did not catch what you just said. Say it again in simpler words and more slowly, in English, in one or two short sentences, then carry on the conversation in your role.';

/**
 * The AgentSession's text input handler (what the browser's `lk.chat`
 * messages reach). The listening help message makes the Agent interrupt
 * itself and say its last words again, simpler and slower, and records the
 * press as a Miss. Any other text is handled as the SDK does by default:
 * interrupt, then reply to the text as the User's own message.
 */
export function createListeningHelpHandler(deps: {
  backend: BackendClient;
  roomName: string;
  now?: () => Date;
}): (session: voice.AgentSession, event: voice.TextInputEvent) => void {
  const { backend, roomName, now = () => new Date() } = deps;

  return (session, event) => {
    if (event.text !== LISTENING_HELP_MESSAGE) {
      session.interrupt();
      session.generateReply({ userInput: event.text });
      return;
    }
    // The press is timed before the interruption, which takes a moment.
    const pressedAt = now();
    session.interrupt();
    // sendMiss never rejects, and the reply does not wait for the backend.
    void backend.sendMiss(roomName, { pressedAt: pressedAt.toISOString() });
    session.generateReply({ instructions: REPHRASE_INSTRUCTION });
  };
}
