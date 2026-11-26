import { type llm, voice } from '@livekit/agents';
import { TUTOR_INSTRUCTIONS } from './tutor-instructions.ts';

/**
 * The Agent that talks with the User in a Conversation: an English tutor
 * that explains in Vietnamese. It has the tools it is given, such as
 * `saveNote`.
 */
export class TutorAgent extends voice.Agent {
  constructor(tools: llm.ToolContextLike = []) {
    super({ instructions: TUTOR_INSTRUCTIONS, tools });
  }
}
