import { voice } from '@livekit/agents';

/**
 * The Agent's instructions: it answers anything, in English, and has no
 * tools. The model reads them, so they use the model's own words.
 */
const INSTRUCTIONS =
  'You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.';

/** The Agent that talks with the User in a Conversation. */
export class ConversationAgent extends voice.Agent {
  constructor() {
    super({ instructions: INSTRUCTIONS });
  }
}
