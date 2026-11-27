import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import type { AgentState } from '@livekit/components-react';
import { type ReactElement, type RefObject, useEffect, useRef } from 'react';
import { NotebookIcon } from '@/icons';
import { AgentStatusLine } from './agent-status';
import { MicToggle } from './mic-toggle';
import type { PanelId } from './use-side-panel';

/**
 * When the side panel closes from inside (Đóng or Escape), the control that
 * had the focus is hidden with it, so the focus would drop to the page. This
 * gives it to the button of the panel that was open instead. When the focus
 * is already in the bar, as after pressing that button, it is left there.
 */
function useFocusBackOnClose(
  panel: PanelId | null,
  bar: RefObject<HTMLElement | null>,
  transcriptButton: RefObject<HTMLButtonElement | null>,
  notesButton: RefObject<HTMLButtonElement | null>,
): void {
  const openBefore = useRef(panel);
  useEffect(() => {
    const closed = openBefore.current;
    openBefore.current = panel;
    if (panel !== null || closed === null) {
      return;
    }
    if (bar.current?.contains(document.activeElement) === true) {
      return;
    }
    const button = closed === 'notes' ? notesButton : transcriptButton;
    button.current?.focus();
  }, [panel, bar, transcriptButton, notesButton]);
}

/**
 * The bar at the bottom of the lesson: how the tutor is doing, above one row
 * of buttons: the microphone, Cuộc nói and Ghi chú, which open and close
 * their panel of the side panel, and Kết thúc. Ghi chú shows how many Notes
 * there are, in blue while some of them are not seen yet.
 */
export function ControlsBar({
  agentState,
  panel,
  onTogglePanel,
  noteCount,
  hasUnseenNotes,
  onEnd,
}: {
  readonly agentState: AgentState;
  /** The open panel of the side panel, or null while it is closed. */
  readonly panel: PanelId | null;
  readonly onTogglePanel: (panel: PanelId) => void;
  readonly noteCount: number;
  readonly hasUnseenNotes: boolean;
  readonly onEnd: () => void;
}): ReactElement {
  const bar = useRef<HTMLDivElement>(null);
  const transcriptButton = useRef<HTMLButtonElement>(null);
  const notesButton = useRef<HTMLButtonElement>(null);
  useFocusBackOnClose(panel, bar, transcriptButton, notesButton);

  return (
    <Stack ref={bar} className="controls-bar" gap={3} align="center">
      <AgentStatusLine agentState={agentState} />
      <HStack gap={2} align="start" justify="center" wrap="wrap">
        <MicToggle />
        <Button
          ref={transcriptButton}
          label="Cuộc nói"
          variant="secondary"
          aria-expanded={panel === 'transcript'}
          onClick={() => {
            onTogglePanel('transcript');
          }}
        />
        <Button
          ref={notesButton}
          label="Ghi chú"
          variant="secondary"
          icon={<Icon icon={NotebookIcon} />}
          aria-expanded={panel === 'notes'}
          endContent={
            noteCount > 0 && (
              <Badge
                variant={hasUnseenNotes ? 'blue' : 'neutral'}
                label={String(noteCount)}
              />
            )
          }
          onClick={() => {
            onTogglePanel('notes');
          }}
        />
        <Button label="Kết thúc" onClick={onEnd} />
      </HStack>
    </Stack>
  );
}
