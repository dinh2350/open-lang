import { Badge } from '@astryxdesign/core/Badge';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { NoteKind, StoredNote } from '@open-lang/shared';
import { type ReactElement, type SVGProps, useId } from 'react';
import { CorrectionIcon, MissedIcon, PhraseIcon, WordIcon } from '@/icons';

/** A kind of Note, as the Member sees its group. */
interface NoteGroup {
  readonly kind: NoteKind;
  readonly title: string;
  readonly Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
}

/** The groups Notes are shown in, in this order. */
export const NOTE_GROUPS: readonly NoteGroup[] = [
  { kind: 'phrase', title: 'Câu hay', Icon: PhraseIcon },
  { kind: 'word', title: 'Từ / cụm', Icon: WordIcon },
  { kind: 'correction', title: 'Sửa lỗi', Icon: CorrectionIcon },
  { kind: 'missed', title: 'Câu nghe sót', Icon: MissedIcon },
];

const NO_NOTES: ReadonlySet<string> = new Set();

interface NoteGroupsProps {
  /** The Notes to show, oldest first. */
  readonly notes: readonly StoredNote[];
  /** The ids of the Notes to mark Mới. */
  readonly newNoteIds?: ReadonlySet<string>;
}

/**
 * Notes grouped by kind, each group under a heading with its icon and how
 * many Notes it has; a group with no Notes is left out. Note text is the
 * Agent's, so it is shown as plain text, never as markup.
 */
export function NoteGroups({ notes, newNoteIds = NO_NOTES }: NoteGroupsProps) {
  return (
    <Stack gap={6}>
      {NOTE_GROUPS.map((group) => {
        const groupNotes = notes.filter((note) => note.kind === group.kind);
        return groupNotes.length === 0 ? null : (
          <NoteGroupSection
            key={group.kind}
            group={group}
            notes={groupNotes}
            newNoteIds={newNoteIds}
          />
        );
      })}
    </Stack>
  );
}

function NoteGroupSection({
  group,
  notes,
  newNoteIds,
}: {
  readonly group: NoteGroup;
  readonly notes: readonly StoredNote[];
  readonly newNoteIds: ReadonlySet<string>;
}) {
  const headingId = useId();
  return (
    <Stack as="section" aria-labelledby={headingId} gap={3}>
      <Heading level={3} id={headingId}>
        <HStack as="span" gap={2} align="center">
          <Icon icon={group.Icon} color="secondary" />
          <span>{`${group.title} (${String(notes.length)})`}</span>
        </HStack>
      </Heading>
      <Stack as="ul" gap={4}>
        {notes.map((note) => (
          <NoteItem key={note.id} note={note} isNew={newNoteIds.has(note.id)} />
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * One Note. A correction shows what the Member said struck through, then the
 * fixed sentence; any other Note shows its English in bold. Every Note then
 * says what it means, or why, in Vietnamese.
 */
function NoteItem({
  note,
  isNew,
}: {
  readonly note: StoredNote;
  readonly isNew: boolean;
}) {
  return (
    <Stack as="li" gap={1}>
      <HStack gap={2} align="center" wrap="wrap">
        {note.said === null ? (
          <Text as="p" weight="bold">
            <span lang="en">{note.english}</span>
          </Text>
        ) : (
          <Text as="p">
            <Text color="secondary">
              <del lang="en">{note.said}</del>
            </Text>
            {' → '}
            <Text weight="bold">
              <ins lang="en">{note.english}</ins>
            </Text>
          </Text>
        )}
        {isNew && <Badge variant="blue" label="Mới" />}
      </HStack>
      <Text as="p" color="secondary">
        {note.meaning}
      </Text>
    </Stack>
  );
}
