import { z } from 'zod';

/**
 * What a Note is for: a good sentence (`phrase`), a word or expression
 * (`word`), the Member's wrong sentence with the fix (`correction`), or a
 * sentence the Member did not hear (`missed`).
 */
export const NOTE_KINDS = ['phrase', 'word', 'correction', 'missed'] as const;

export const noteKindSchema = z.enum(NOTE_KINDS);

export type NoteKind = z.infer<typeof noteKindSchema>;

/** The most characters each text field of a Note may hold. */
export const NOTE_LIMITS = { english: 120, meaning: 120, said: 120 } as const;

/** The most Notes the Agent may write in one Conversation. */
export const MAX_NOTES_PER_CONVERSATION = 50;

const noteFields = {
  kind: noteKindSchema,
  /** The English to learn. For a correction, the fixed sentence. */
  english: z.string().min(1).max(NOTE_LIMITS.english),
  /** What it means or why, in Vietnamese. */
  meaning: z.string().min(1).max(NOTE_LIMITS.meaning),
  /** What the Member said. Only a correction has it; the other kinds are null. */
  said: z.string().min(1).max(NOTE_LIMITS.said).nullable(),
};

/** `said` is there for a correction and for no other kind of Note. */
const saidOnlyForCorrection = z.check<{
  kind: NoteKind;
  said: string | null;
}>((context) => {
  const { kind, said } = context.value;
  if (kind === 'correction' && said === null) {
    context.issues.push({
      code: 'custom',
      input: context.value,
      path: ['said'],
      message: 'A correction needs what the Member said.',
    });
  } else if (kind !== 'correction' && said !== null) {
    context.issues.push({
      code: 'custom',
      input: context.value,
      path: ['said'],
      message: 'Only a correction has what the Member said.',
    });
  }
});

/** What the Agent writes down for the Member during a Conversation. */
export const noteSchema = z.object(noteFields).check(saidOnlyForCorrection);

export type Note = z.infer<typeof noteSchema>;

/** A Note as the backend keeps and returns it. */
export const storedNoteSchema = z
  .object({
    ...noteFields,
    id: z.string().min(1),
    createdAt: z.iso.datetime(),
  })
  .check(saidOnlyForCorrection);

export type StoredNote = z.infer<typeof storedNoteSchema>;

/** Body of the response that lists the Notes of a Conversation. */
export const noteListSchema = z.object({
  notes: z.array(storedNoteSchema),
});

export type NoteList = z.infer<typeof noteListSchema>;
