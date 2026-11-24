import { Text } from '@astryxdesign/core/Text';
import type { StoredNote } from '@open-lang/shared';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { fetchNotes } from '@/conversations/conversations-api';
import { NoteGroups } from '@/notes/note-groups';

/** How often the panel asks the backend for the Notes again. */
export const NOTES_POLL_MILLISECONDS = 2000;

const NO_NOTES: ReadonlySet<string> = new Set();

/**
 * The key of a room's Notes. It names the User, so a User who signs in on
 * this tab never meets what another User loaded here.
 */
function notesQueryKey(userId: string | undefined, roomName: string) {
  return ['conversations', userId, roomName, 'notes'] as const;
}

/** The Notes of the room, as the panel last fetched them, oldest first. */
interface FetchedNotes {
  /** When they were fetched. */
  readonly fetchedAt: number;
  readonly ids: ReadonlySet<string>;
  /** The ids that were not there the fetch before. */
  readonly newIds: ReadonlySet<string>;
}

/**
 * The ids of the Notes that came with the latest fetch; on the first fetch,
 * none. A fetch that fails changes nothing, so a Note stays new until the
 * next fetch that succeeds.
 */
function useNewNoteIds(
  notes: readonly StoredNote[] | undefined,
  fetchedAt: number,
): ReadonlySet<string> {
  const [fetched, setFetched] = useState<FetchedNotes | null>(null);
  if (notes !== undefined && fetched?.fetchedAt !== fetchedAt) {
    const ids = new Set(notes.map((note) => note.id));
    const before = fetched?.ids;
    setFetched({
      fetchedAt,
      ids,
      newIds:
        before === undefined
          ? NO_NOTES
          : new Set([...ids].filter((id) => !before.has(id))),
    });
  }
  return fetched?.newIds ?? NO_NOTES;
}

/** What the panel says before the tutor has written a Note. */
export function NotesEmpty() {
  return (
    <Text as="p" color="secondary">
      Gia sư sẽ ghi những điều đáng nhớ ở đây.
    </Text>
  );
}

/**
 * The Notes the tutor writes during the Conversation in `roomName`, asked
 * for again every two seconds. A Note that came with the latest answer is
 * marked Mới. When asking fails, the panel keeps the Notes it has.
 */
export function NotesPanel({ roomName }: { readonly roomName: string }) {
  const { user, authorizedFetch } = useAuth();
  const { data: notes, dataUpdatedAt } = useQuery({
    queryKey: notesQueryKey(user?.id, roomName),
    queryFn: () => fetchNotes(authorizedFetch, roomName),
    refetchInterval: NOTES_POLL_MILLISECONDS,
    // The next poll is the retry.
    retry: false,
  });
  const newNoteIds = useNewNoteIds(notes, dataUpdatedAt);
  return notes === undefined || notes.length === 0 ? (
    <NotesEmpty />
  ) : (
    <NoteGroups notes={notes} newNoteIds={newNoteIds} />
  );
}

/**
 * How many Notes the NotesPanel of `roomName` shows. It only reads what the
 * panel fetched, so it asks the backend nothing.
 */
export function useNoteCount(roomName: string | null): number {
  const { user } = useAuth();
  const { data: notes } = useQuery<StoredNote[]>({
    queryKey: notesQueryKey(user?.id, roomName ?? ''),
    queryFn: skipToken,
  });
  return roomName === null ? 0 : (notes?.length ?? 0);
}
