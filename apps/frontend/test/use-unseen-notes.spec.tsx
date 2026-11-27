import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useUnseenNotes } from '@/conversation/use-unseen-notes';

/** The hook with `noteCount` notes, and the Ghi chú tab shown or not. */
function renderUnseenNotes(noteCount: number, isNotesShown: boolean) {
  const { result, rerender } = renderHook(
    ({ count, isShown }: { count: number; isShown: boolean }) =>
      useUnseenNotes(count, isShown),
    { initialProps: { count: noteCount, isShown: isNotesShown } },
  );
  return {
    hasUnseen: () => result.current,
    /** The count becomes `count`, and the tab is shown or not. */
    becomes: (count: number, isShown: boolean) => {
      rerender({ count, isShown });
    },
  };
}

describe('useUnseenNotes', () => {
  it('is false while nothing has arrived', () => {
    const notes = renderUnseenNotes(0, false);

    expect(notes.hasUnseen()).toBe(false);
  });

  it('is true when notes arrive while the Ghi chú tab is not shown', () => {
    const notes = renderUnseenNotes(0, false);

    notes.becomes(2, false);

    expect(notes.hasUnseen()).toBe(true);
  });

  it('clears when the Ghi chú tab is shown', () => {
    const notes = renderUnseenNotes(0, false);
    notes.becomes(2, false);

    notes.becomes(2, true);
    expect(notes.hasUnseen()).toBe(false);

    // Hiding the tab again does not bring back the notes already seen.
    notes.becomes(2, false);
    expect(notes.hasUnseen()).toBe(false);
  });

  it('stays false for notes that arrive while the tab is shown', () => {
    const notes = renderUnseenNotes(0, true);

    notes.becomes(3, true);
    expect(notes.hasUnseen()).toBe(false);

    notes.becomes(3, false);
    expect(notes.hasUnseen()).toBe(false);
  });

  it('comes back for notes that arrive after the tab is hidden again', () => {
    const notes = renderUnseenNotes(1, true);
    notes.becomes(1, false);
    expect(notes.hasUnseen()).toBe(false);

    notes.becomes(2, false);

    expect(notes.hasUnseen()).toBe(true);
  });
});
