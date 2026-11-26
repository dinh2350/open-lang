import { describe, expect, it } from 'vitest';
import {
  MAX_NOTES_PER_CONVERSATION,
  NOTE_KINDS,
  NOTE_LIMITS,
  noteListSchema,
  noteSchema,
  storedNoteSchema,
} from '../src/note.ts';

const meaning = 'Một câu nói lịch sự khi bạn đến muộn.';

const note = {
  kind: 'phrase',
  english: 'Sorry I am late.',
  meaning,
  said: null,
};

describe('Note contract', () => {
  it('accepts each kind with english and meaning', () => {
    for (const kind of NOTE_KINDS) {
      const said = kind === 'correction' ? 'I finish yesterday' : null;
      const result = noteSchema.safeParse({
        kind,
        english: 'I finished yesterday.',
        meaning,
        said,
      });

      expect(result.success).toBe(true);
    }
  });

  it('requires said for a correction', () => {
    const result = noteSchema.safeParse({
      kind: 'correction',
      english: 'I finished',
      meaning,
      said: null,
    });

    expect(result.success).toBe(false);
  });

  it('refuses said on any other kind', () => {
    for (const kind of NOTE_KINDS.filter((kind) => kind !== 'correction')) {
      const result = noteSchema.safeParse({ ...note, kind, said: 'x' });

      expect(result.success).toBe(false);
    }
  });

  it('refuses english over 120 characters', () => {
    const english = (length: number) => 'a'.repeat(length);

    expect(
      noteSchema.safeParse({ ...note, english: english(120) }).success,
    ).toBe(true);
    expect(
      noteSchema.safeParse({ ...note, english: english(121) }).success,
    ).toBe(false);
  });

  it('refuses meaning over 120 characters', () => {
    const meaningOf = (length: number) => 'a'.repeat(length);

    expect(
      noteSchema.safeParse({ ...note, meaning: meaningOf(120) }).success,
    ).toBe(true);
    expect(
      noteSchema.safeParse({ ...note, meaning: meaningOf(121) }).success,
    ).toBe(false);
  });

  it('refuses said over 120 characters', () => {
    const correction = (length: number) => ({
      ...note,
      kind: 'correction',
      said: 'a'.repeat(length),
    });

    expect(noteSchema.safeParse(correction(120)).success).toBe(true);
    expect(noteSchema.safeParse(correction(121)).success).toBe(false);
  });

  it('refuses empty english or meaning', () => {
    expect(noteSchema.safeParse({ ...note, english: '' }).success).toBe(false);
    expect(noteSchema.safeParse({ ...note, meaning: '' }).success).toBe(false);
  });

  it('refuses an unknown kind', () => {
    expect(noteSchema.safeParse({ ...note, kind: 'idiom' }).success).toBe(
      false,
    );
  });

  it('parses a stored note with id and createdAt', () => {
    const stored = {
      ...note,
      id: '8f14e45f-ceea-4e67-a3c0-1d8a3b6b9c11',
      createdAt: '2026-11-24T09:30:00.000Z',
    };

    expect(storedNoteSchema.parse(stored)).toEqual(stored);
    expect(
      storedNoteSchema.safeParse({ ...stored, createdAt: 'yesterday' }).success,
    ).toBe(false);
    expect(
      storedNoteSchema.safeParse({ ...stored, kind: 'correction' }).success,
    ).toBe(false);
  });

  it('parses a note list', () => {
    expect(noteListSchema.safeParse({ notes: [] }).success).toBe(true);
  });

  it('states its limits', () => {
    expect(NOTE_LIMITS).toEqual({ english: 120, meaning: 120, said: 120 });
    expect(MAX_NOTES_PER_CONVERSATION).toBe(50);
  });
});
