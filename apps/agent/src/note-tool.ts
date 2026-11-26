import { llm } from '@livekit/agents';
import { NOTE_LIMITS, noteKindSchema, noteSchema } from '@open-lang/shared';
import { z } from 'zod';
import type { BackendClient } from './backend-client.ts';

const DESCRIPTION = [
  'Saves a note the User reviews after the lesson.',
  'Use it for a few important items only: a useful phrase, a word, a correction of what the User said, or a sentence the User missed.',
  'Also use it when the User says "ghi lại câu này".',
  'Do not use it for small talk, for something already saved, or for every sentence.',
  // The limit is in the parameters too, but a model can overshoot it: say it.
  `Keep each field under ${String(NOTE_LIMITS.english)} characters.`,
].join(' ');

/**
 * The tool's arguments. OpenAI's strict mode needs every field, so `said` is
 * nullable rather than optional.
 */
const parameters = z.object({
  kind: noteKindSchema.describe(
    "phrase: a useful sentence; word: a word or expression; correction: the User's wrong sentence and its fix; missed: a sentence the User did not hear or understand",
  ),
  english: z
    .string()
    .max(NOTE_LIMITS.english)
    .describe('The English to learn. For a correction, the fixed sentence.'),
  meaning: z
    .string()
    .max(NOTE_LIMITS.meaning)
    .describe('What it means, or why, in Vietnamese.'),
  said: z
    .string()
    .max(NOTE_LIMITS.said)
    .nullable()
    .describe(
      'For a correction, what the User said. Null for every other kind.',
    ),
});

/**
 * The `saveNote` tool: the model writes down a Note, which goes to the
 * backend under the Conversation's room. An invalid Note is returned to the
 * model as an error naming the problem. A valid one returns nothing, so the
 * tool completes silently and the conversation goes on.
 */
export function createSaveNoteTool(deps: {
  backend: BackendClient;
  roomName: string;
}) {
  const { backend, roomName } = deps;
  return llm.tool({
    name: 'saveNote',
    description: DESCRIPTION,
    parameters,
    execute: async (args) => {
      // Models often send "" for what should be null. A blank `said` is none,
      // so a correction without one is still refused, with a clear reason.
      const said = args.said?.trim() ? args.said : null;
      const note = noteSchema.safeParse({ ...args, said });
      if (!note.success) {
        throw new llm.ToolError(
          `The note was not saved: ${note.error.issues
            .map(
              ({ path, message }) => `${path.join('.') || 'note'}: ${message}`,
            )
            .join('; ')}`,
        );
      }
      // Never rejects: a backend that is down only costs the note.
      await backend.sendNote(roomName, note.data);
    },
  });
}
