import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import type { PanelId } from './use-side-panel';
import './side-panel.css';

/**
 * What is said and the Notes, in a panel beside the lesson. It is part of the
 * page, not a dialog: nothing behind it is blocked, so the microphone and
 * Kết thúc stay usable while it is open, and Escape inside it closes it.
 *
 * Both panels are always in the document, and the ones not shown are only
 * hidden, so the transcript keeps the lines said so far and the Notes keep
 * loading while the side panel is closed. That is why the content comes in as
 * `transcript` and `notes` nodes the page renders, never as something this
 * panel mounts when it opens.
 */
export function SidePanel({
  panel,
  onSelect,
  onClose,
  noteCount,
  transcript,
  notes,
}: {
  /** The open panel, or null while the side panel is closed. */
  readonly panel: PanelId | null;
  readonly onSelect: (panel: PanelId) => void;
  readonly onClose: () => void;
  /** How many Notes there are, shown on the Ghi chú tab above zero. */
  readonly noteCount: number;
  readonly transcript: ReactNode;
  readonly notes: ReactNode;
}) {
  const transcriptId = useId();
  const notesId = useId();
  const asideRef = useRef<HTMLElement>(null);

  // Escape closes the panel from anywhere inside it. The listener is on the
  // aside, which is a landmark and not a control, so it is added here and not
  // as an onKeyDown prop: the keys bubble up from the tabs and the buttons.
  useEffect(() => {
    const aside = asideRef.current;
    if (aside === null) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    aside.addEventListener('keydown', closeOnEscape);
    return () => {
      aside.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <aside
      ref={asideRef}
      className="side-panel"
      aria-label="Cuộc nói và ghi chú"
      hidden={panel === null}
    >
      <HStack className="side-panel-header" gap={2} align="center">
        <TabList
          className="side-panel-tabs"
          role="tablist"
          hasDivider
          layout="fill"
          value={panel ?? ''}
          onChange={(value) => {
            onSelect(value === 'notes' ? 'notes' : 'transcript');
          }}
        >
          <Tab value="transcript" label="Cuộc nói" panelId={transcriptId} />
          <Tab
            value="notes"
            label="Ghi chú"
            panelId={notesId}
            endContent={
              noteCount > 0 && (
                <Badge variant="neutral" label={String(noteCount)} />
              )
            }
          />
        </TabList>
        <Button
          label="Đóng"
          variant="ghost"
          isIconOnly
          icon={<Icon icon="close" />}
          onClick={onClose}
        />
      </HStack>
      <div
        id={transcriptId}
        className="side-panel-transcript"
        role="tabpanel"
        aria-label="Cuộc nói"
        hidden={panel !== 'transcript'}
      >
        {transcript}
      </div>
      <div
        id={notesId}
        className="side-panel-notes"
        role="tabpanel"
        aria-label="Ghi chú"
        hidden={panel !== 'notes'}
      >
        {notes}
      </div>
    </aside>
  );
}
