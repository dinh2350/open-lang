import { describe, expect, it } from 'vitest';
import {
  OPENING_INSTRUCTIONS,
  OPENING_LINE,
  TUTOR_INSTRUCTIONS,
  tutorInstructions,
} from '../src/tutor-instructions.ts';

describe('The tutor instructions', () => {
  it('explains in Vietnamese and models sentences in English', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(/Vietnamese/);
    expect(TUTOR_INSTRUCTIONS).toMatch(/English/);
  });

  it('allows correcting the User at any time', () => {
    expect(TUTOR_INSTRUCTIONS).not.toContain('Never comment on or correct');
    expect(TUTOR_INSTRUCTIONS).toMatch(/correct/);
  });

  it('repeat slower on request', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(/slower/);
    expect(TUTOR_INSTRUCTIONS).toMatch(/repeat/);
  });

  it('missed note rule', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(/missed/);
    expect(TUTOR_INSTRUCTIONS).toMatch(/off-topic|does not answer/);
    expect(TUTOR_INSTRUCTIONS).toMatch(/could not (hear|catch)/);
  });

  it('asks for few, important notes', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(/few/);
    expect(TUTOR_INSTRUCTIONS).toContain('ghi lại câu này');
  });

  it('tells the tutor to save a correction when it corrects', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(
      /When you correct the User, call saveNote with kind 'correction'/,
    );
    expect(TUTOR_INSTRUCTIONS).toMatch(/said set to what the User said/);
  });

  it('tells the tutor to save a phrase after the User practised a model sentence', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(
      /practised an English model sentence that you taught, call saveNote with kind 'phrase'/,
    );
  });

  it('tells the tutor to save a word when it teaches one', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(
      /teach a new useful word or expression, call saveNote with kind 'word'/,
    );
  });

  it('tells the tutor never to save the same thing twice', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(/Never save the same thing twice/);
  });

  it('tells the tutor to speak first and call saveNote after speaking, by default', () => {
    expect(TUTOR_INSTRUCTIONS).toBe(tutorInstructions('after-speaking'));
    expect(TUTOR_INSTRUCTIONS).toMatch(/say your reply first/i);
    expect(TUTOR_INSTRUCTIONS).toMatch(/saveNote after speaking/);
    expect(TUTOR_INSTRUCTIONS).not.toMatch(/saveNote first/);
  });

  it('tells the tutor to call saveNote first and then speak, when asked', () => {
    const instructions = tutorInstructions('before-speaking');

    expect(instructions).toMatch(/call saveNote first, before you speak/i);
    expect(instructions).not.toMatch(/say your reply first/i);
    expect(instructions).not.toMatch(/saveNote after speaking/);
  });

  it('gives no order for the missed note, which would contradict the one it was asked for', () => {
    for (const order of ['after-speaking', 'before-speaking'] as const) {
      expect(tutorInstructions(order)).not.toMatch(
        /Then call saveNote with kind 'missed'/,
      );
    }
  });

  it('differs only in the order of the note and the reply', () => {
    const lines = (text: string) => text.split('\n');
    const same = (line: string) => !/saveNote (first|after)/.test(line);

    expect(lines(tutorInstructions('before-speaking')).filter(same)).toEqual(
      lines(tutorInstructions('after-speaking')).filter(same),
    );
  });

  it('says a plain request to repeat is not a missed sentence', () => {
    expect(TUTOR_INSTRUCTIONS).toMatch(
      /request to repeat or to speak slower is not a missed sentence/,
    );
    expect(TUTOR_INSTRUCTIONS).toMatch(/do not save a note for it/);
  });

  it('says nothing about Scenario or role-play', () => {
    expect(TUTOR_INSTRUCTIONS).not.toMatch(/Scenario|role-play/);
  });
});

describe('The opening', () => {
  it('is a Vietnamese question about what to learn today', () => {
    expect(OPENING_LINE).toBe('Chào bạn! Hôm nay bạn muốn học gì?');
  });

  it('tells the model to say the opening line exactly, in quotes at the end', () => {
    expect(OPENING_INSTRUCTIONS.endsWith(`"${OPENING_LINE}"`)).toBe(true);
  });
});
