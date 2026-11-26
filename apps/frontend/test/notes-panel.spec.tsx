import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOTES_POLL_MILLISECONDS,
  NotesPanel,
} from '@/conversation/notes-panel';
import {
  backendHasNotes,
  noteOf,
  notesRequestsFail,
  notesRequestsReceived,
} from './conversations-backend';
import { withQueryClient } from './query-client';

const ROOM = 'conversation-1';

function renderNotesPanel(): void {
  render(withQueryClient(<NotesPanel roomName={ROOM} />));
}

/** The next poll: two seconds pass, and the backend answers. */
async function nextPoll(): Promise<void> {
  const requestsBefore = notesRequestsReceived().length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(NOTES_POLL_MILLISECONDS);
  });
  await waitFor(() => {
    expect(notesRequestsReceived()).toHaveLength(requestsBefore + 1);
  });
}

/** The list item that shows this English. */
function noteItem(english: string): HTMLElement {
  const item = screen.getByText(english).closest('li');
  if (item === null) {
    throw new Error(`${english} is not in a list item`);
  }
  return item;
}

describe('NotesPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows notes from the backend', async () => {
    backendHasNotes(ROOM, [
      noteOf('phrase', 'That makes sense.'),
      noteOf('word', 'run by'),
    ]);

    renderNotesPanel();

    expect(await screen.findByText('That makes sense.')).toBeVisible();
    expect(screen.getByText('run by')).toBeVisible();
    expect(notesRequestsReceived()).toEqual([ROOM]);
  });

  it('asks again every 2 seconds and shows a new note with Mới', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    backendHasNotes(ROOM, [noteOf('phrase', 'That makes sense.')]);
    renderNotesPanel();
    await screen.findByText('That makes sense.');
    expect(NOTES_POLL_MILLISECONDS).toBe(2000);

    backendHasNotes(ROOM, [
      noteOf('phrase', 'That makes sense.'),
      noteOf('word', 'run by'),
    ]);
    await nextPoll();

    expect(await screen.findByText('run by')).toBeVisible();
    expect(within(noteItem('run by')).getByText('Mới')).toBeVisible();
    expect(
      within(noteItem('That makes sense.')).queryByText('Mới'),
    ).not.toBeInTheDocument();

    // The badge lasts until the poll after the one that brought the note.
    await nextPoll();
    await waitFor(() => {
      expect(screen.queryByText('Mới')).not.toBeInTheDocument();
    });
    expect(screen.getByText('run by')).toBeVisible();
  });

  it('keeps the notes it has when a poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    backendHasNotes(ROOM, [noteOf('phrase', 'That makes sense.')]);
    renderNotesPanel();
    await screen.findByText('That makes sense.');

    notesRequestsFail();
    await nextPoll();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('That makes sense.')).toBeVisible();
  });

  it('says Gia sư sẽ ghi những điều đáng nhớ ở đây. when empty', async () => {
    renderNotesPanel();

    expect(
      await screen.findByText('Gia sư sẽ ghi những điều đáng nhớ ở đây.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(notesRequestsReceived()).toEqual([ROOM]);
    });
  });
});
