import { describe, expect, it } from 'vitest';
import { splitKeyPhrases } from '@/conversations/key-phrases';

describe('splitKeyPhrases', () => {
  it('marks every occurrence of a phrase, in any letter case, and keeps the sentence intact', () => {
    const pieces = splitKeyPhrases('Sure. Sure, I can.', ['sure']);

    expect(pieces).toEqual([
      { text: 'Sure', isKeyPhrase: true },
      { text: '. ', isKeyPhrase: false },
      { text: 'Sure', isKeyPhrase: true },
      { text: ', I can.', isKeyPhrase: false },
    ]);
  });

  it('matches the longest phrase first and gives a stretch to one phrase only', () => {
    const pieces = splitKeyPhrases('Walk me through it', [
      'through',
      'walk me through',
    ]);

    expect(pieces).toEqual([
      { text: 'Walk me through', isKeyPhrase: true },
      { text: ' it', isKeyPhrase: false },
    ]);
  });

  it('matches a phrase as text, not as a pattern, and skips empty phrases', () => {
    const pieces = splitKeyPhrases('a.b and axb', ['a.b', '']);

    expect(pieces).toEqual([
      { text: 'a.b', isKeyPhrase: true },
      { text: ' and axb', isKeyPhrase: false },
    ]);
  });

  it('leaves a sentence without a matching phrase as it is', () => {
    expect(splitKeyPhrases('Hello there', ['bye'])).toEqual([
      { text: 'Hello there', isKeyPhrase: false },
    ]);
    expect(splitKeyPhrases('', ['bye'])).toEqual([]);
  });

  it('does not mark anything when lower-casing changes the length of the sentence', () => {
    // "İ" lower-cases to two code units, which would shift every range.
    expect(splitKeyPhrases('İstanbul office', ['office'])).toEqual([
      { text: 'İstanbul office', isKeyPhrase: false },
    ]);
  });
});
