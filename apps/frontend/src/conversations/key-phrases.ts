/** A stretch of a sentence, and whether it is one of its key phrases. */
export interface SentencePiece {
  readonly text: string;
  readonly isKeyPhrase: boolean;
}

type Range = readonly [start: number, end: number];

function overlaps(claimed: readonly Range[], start: number, end: number) {
  return claimed.some(([claimedStart, claimedEnd]) => {
    return start < claimedEnd && end > claimedStart;
  });
}

/** Where `needle` is in `haystack`, ignoring what an earlier match already holds. */
function freeRangesOf(
  haystack: string,
  needle: string,
  claimed: readonly Range[],
): Range[] {
  const found: Range[] = [];
  let start = haystack.indexOf(needle);
  while (start !== -1) {
    const end = start + needle.length;
    if (!overlaps([...claimed, ...found], start, end)) {
      found.push([start, end]);
    }
    start = haystack.indexOf(needle, start + 1);
  }
  return found;
}

/**
 * Splits a sentence into the stretches that are key phrases and the rest.
 * A phrase matches wherever it appears, in any letter case, as plain text
 * (never as a pattern). Longer phrases are matched first, and a stretch
 * belongs to at most one phrase. The pieces joined give back `sentence`.
 */
export function splitKeyPhrases(
  sentence: string,
  keyPhrases: readonly string[],
): SentencePiece[] {
  const lowerSentence = sentence.toLowerCase();
  // Lower-casing some letters changes the length, which would shift ranges.
  if (lowerSentence.length !== sentence.length) {
    return [{ text: sentence, isKeyPhrase: false }];
  }
  const claimed: Range[] = [];
  const longestFirst = [...keyPhrases].sort((a, b) => b.length - a.length);
  for (const phrase of longestFirst) {
    const needle = phrase.toLowerCase();
    if (needle.length > 0 && needle.length === phrase.length) {
      claimed.push(...freeRangesOf(lowerSentence, needle, claimed));
    }
  }
  claimed.sort((a, b) => a[0] - b[0]);

  const pieces: SentencePiece[] = [];
  let position = 0;
  for (const [start, end] of claimed) {
    if (start > position) {
      pieces.push({
        text: sentence.slice(position, start),
        isKeyPhrase: false,
      });
    }
    pieces.push({ text: sentence.slice(start, end), isKeyPhrase: true });
    position = end;
  }
  if (position < sentence.length) {
    pieces.push({ text: sentence.slice(position), isKeyPhrase: false });
  }
  return pieces;
}
