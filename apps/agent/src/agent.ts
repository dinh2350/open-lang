import { type llm, voice } from '@livekit/agents';
import type { LearnerBrief } from '@open-lang/shared';
import { type NoteOrder, tutorInstructions } from './tutor-instructions.ts';

/**
 * The Agent that talks with the User in a Conversation: an English tutor
 * that explains in Vietnamese. It has the tools it is given, such as
 * `saveNote`, and calls them in the given order: after it has spoken, or
 * before. With a learner brief it knows what the User has already studied,
 * and does not teach it as new.
 */
export class TutorAgent extends voice.Agent {
  constructor(
    tools: llm.ToolContextLike = [],
    noteOrder: NoteOrder = 'after-speaking',
    brief: LearnerBrief | null = null,
  ) {
    super({ instructions: tutorInstructions(noteOrder, brief), tools });
  }
}
