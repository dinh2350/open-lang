import { describe, expect, it } from 'vitest';
import {
  OPENING_INSTRUCTIONS,
  OPENING_LINE,
  TUTOR_INSTRUCTIONS,
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
