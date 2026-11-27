import { RoomContext } from '@livekit/components-react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ControlsBar } from '@/conversation/controls-bar';
import { getStatusMessage } from './status-message';
import { createUnconnectedRoom } from './unconnected-room';

/**
 * ControlsBar in a room the Member joined with the microphone on, the Agent
 * listening and the side panel closed. The two callbacks are spies.
 */
async function renderControlsBar(
  props: Partial<ComponentProps<typeof ControlsBar>> = {},
) {
  const liveKit = createUnconnectedRoom();
  liveKit.joins();
  await liveKit.room.localParticipant.setMicrophoneEnabled(true);
  const onTogglePanel = vi.fn();
  const onEnd = vi.fn();
  render(
    <RoomContext value={liveKit.room}>
      <ControlsBar
        agentState="listening"
        panel={null}
        onTogglePanel={onTogglePanel}
        noteCount={0}
        hasUnseenNotes={false}
        onEnd={onEnd}
        {...props}
      />
    </RoomContext>,
  );
  return { onTogglePanel, onEnd };
}

/** The Badge on the Ghi chú button that shows `count`. */
function noteCountBadge(count: string): HTMLElement {
  const button = screen.getByRole('button', { name: /^Ghi chú/ });
  const badge = within(button).getByText(count).closest('[data-variant]');
  if (!(badge instanceof HTMLElement)) {
    throw new Error(`no badge with ${count} on Ghi chú`);
  }
  return badge;
}

describe('ControlsBar', () => {
  it('has the buttons Tắt mic, Cuộc nói, Ghi chú and Kết thúc, with the status line above them', async () => {
    await renderControlsBar();

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Tắt mic',
      'Cuộc nói',
      'Ghi chú',
      'Kết thúc',
    ]);
    const status = getStatusMessage();
    expect(status).toHaveTextContent('Gia sư đang nghe bạn nói.');
    expect(status).toBeVisible();
    for (const button of buttons) {
      expect(
        status.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('marks the button of the open panel with aria-expanded', async () => {
    await renderControlsBar({ panel: 'notes' });

    expect(screen.getByRole('button', { name: 'Ghi chú' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Cuộc nói' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows the note count on Ghi chú, in blue when there are unseen notes', async () => {
    await renderControlsBar({ noteCount: 2, hasUnseenNotes: true });

    expect(screen.getByRole('button', { name: /^Ghi chú/ })).toHaveTextContent(
      'Ghi chú2',
    );
    expect(noteCountBadge('2')).toHaveAttribute('data-variant', 'blue');
  });

  it('shows the note count in neutral when every note is seen', async () => {
    await renderControlsBar({ noteCount: 2, hasUnseenNotes: false });
    expect(noteCountBadge('2')).toHaveAttribute('data-variant', 'neutral');
  });

  it('shows no count on Ghi chú while there are no notes', async () => {
    await renderControlsBar({ noteCount: 0 });

    expect(screen.getByRole('button', { name: 'Ghi chú' })).toHaveTextContent(
      /^Ghi chú$/,
    );
  });

  it('calls onTogglePanel with the panel of the button pressed', async () => {
    const { onTogglePanel } = await renderControlsBar();

    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    expect(onTogglePanel).toHaveBeenLastCalledWith('transcript');

    await userEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));
    expect(onTogglePanel).toHaveBeenLastCalledWith('notes');
    expect(onTogglePanel).toHaveBeenCalledTimes(2);
  });

  it('Kết thúc calls onEnd', async () => {
    const { onEnd, onTogglePanel } = await renderControlsBar();

    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(onEnd).toHaveBeenCalledOnce();
    expect(onTogglePanel).not.toHaveBeenCalled();
  });
});
