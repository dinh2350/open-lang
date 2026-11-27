import { useState } from 'react';

/**
 * Whether there are Notes the Member has not seen: `noteCount` is above the
 * number of Notes there were the last time the Ghi chú tab was shown. While
 * `isNotesShown` is true, every Note counts as seen.
 */
export function useUnseenNotes(
  noteCount: number,
  isNotesShown: boolean,
): boolean {
  const [seenCount, setSeenCount] = useState(0);
  // Adjusted while rendering, as React advises for state that follows props.
  if (isNotesShown && seenCount !== noteCount) {
    setSeenCount(noteCount);
  }
  return !isNotesShown && noteCount > seenCount;
}
