import { voice } from '@livekit/agents';
import type { ConversationChoice } from '@open-lang/shared';
import { scenarioInstructions } from './scenario-instructions.ts';

/**
 * The Agent that talks with the User in a Conversation. It plays the
 * persona of the chosen Scenario at the chosen speed, and has no tools.
 */
export class ConversationAgent extends voice.Agent {
  constructor(choice: ConversationChoice) {
    super({ instructions: scenarioInstructions(choice) });
  }
}
