import { RoomContext } from '@livekit/components-react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TranscriptPanel } from '@/conversation/transcript-panel';
import { layOutScrollBox } from './scroll-box';
import { createUnconnectedRoom } from './unconnected-room';

/**
 * TranscriptPanel in a room the Member and the Agent joined, shown unless
 * `isShown` is false. `show` shows it, as a layout that hid it does.
 */
function renderTranscriptPanel(isShown = true) {
  const liveKit = createUnconnectedRoom();
  liveKit.joins();
  liveKit.agentJoins();
  const panel = (shown: boolean) => (
    <RoomContext value={liveKit.room}>
      <TranscriptPanel isShown={shown} />
    </RoomContext>
  );
  const { rerender } = render(panel(isShown));
  return {
    liveKit,
    show: () => {
      rerender(panel(true));
    },
  };
}

/** The box the lines scroll in, laid out with `contentHeight` of content. */
function layOutLines(contentHeight: number) {
  return layOutScrollBox(
    screen.getByRole('group', { name: 'Các lượt nói' }),
    contentHeight,
  );
}

/** The button that scrolls to the newest line, if it is on screen. */
function scrollDownButton() {
  return screen.queryByRole('button', { name: 'Xuống cuối' });
}

/** Each line on screen as [who, what they said], top to bottom. */
function lines(): (string | null | undefined)[][] {
  return screen
    .getAllByRole('listitem')
    .map((line) => [
      within(line).getByText(/^(Gia sư|Bạn)$/).textContent,
      line.querySelector('p')?.textContent,
    ]);
}

describe('TranscriptPanel', () => {
  it('shows both sides in order', async () => {
    const { liveKit } = renderTranscriptPanel();

    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    act(() => {
      liveKit.agentSays('segment-3', 'What did you do?');
    });

    await waitFor(() => {
      expect(lines()).toEqual([
        ['Gia sư', 'Hi! How was your weekend?'],
        ['Bạn', 'It was great.'],
        ['Gia sư', 'What did you do?'],
      ]);
    });
  });

  it('does not mark a line as English: the tutor explains in Vietnamese', async () => {
    const { liveKit } = renderTranscriptPanel();

    act(() => {
      liveKit.agentSays(
        'segment-1',
        'Bạn nói "I fixed the bug." nhé, vì chuyện đã xảy ra rồi.',
      );
    });
    act(() => {
      liveKit.memberSays('segment-2', 'I fixed the bug.');
    });

    await screen.findByText('I fixed the bug.');
    const allLines = screen.getAllByRole('listitem');
    expect(allLines).toHaveLength(2);
    for (const line of allLines) {
      expect(line.querySelector('[lang]')).toBeNull();
      expect(line).not.toHaveAttribute('lang', 'en');
    }
  });

  it('marks the line being spoken as live', async () => {
    const { liveKit } = renderTranscriptPanel();
    act(() => {
      liveKit.agentIs('speaking');
      liveKit.agentSays('segment-1', 'Hi! How was');
    });
    const agentLine = await screen.findByText('Hi! How was');
    expect(agentLine.closest('li')).toHaveTextContent('Đang nói');

    act(() => {
      liveKit.agentIs('listening');
      liveKit.memberSays('segment-2', 'It was', { final: false });
    });
    const memberLine = await screen.findByText('It was');
    expect(memberLine.closest('li')).toHaveTextContent('Đang nói');
    expect(agentLine.closest('li')).not.toHaveTextContent('Đang nói');

    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    await screen.findByText('It was great.');
    expect(screen.queryByText('Đang nói')).not.toBeInTheDocument();
    expect(lines()).toEqual([
      ['Gia sư', 'Hi! How was'],
      ['Bạn', 'It was great.'],
    ]);
  });

  it('says Chữ của cuộc nói sẽ hiện ở đây. when empty', () => {
    renderTranscriptPanel();

    expect(screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.')).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows Xuống cuối only when there are lines and the Member is not at the bottom', async () => {
    const { liveKit } = renderTranscriptPanel();
    const box = layOutLines(1000);

    // Scrolled up, but with no lines there is nothing to go down to.
    box.scrollTo(100);
    expect(scrollDownButton()).not.toBeInTheDocument();

    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    expect(await screen.findByText('Hi! How was your weekend?')).toBeVisible();
    expect(scrollDownButton()).toBeVisible();

    box.scrollTo(800);
    expect(scrollDownButton()).not.toBeInTheDocument();
  });

  it('keeps the view where the Member scrolled when a line arrives', async () => {
    const { liveKit } = renderTranscriptPanel();
    const box = layOutLines(1000);
    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    await screen.findByText('Hi! How was your weekend?');
    box.scrollTo(100);

    box.growTo(1300);
    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    await screen.findByText('It was great.');

    expect(box.scrollTop()).toBe(100);
    expect(scrollDownButton()).toBeVisible();
  });

  it('Xuống cuối brings back the newest line', async () => {
    const { liveKit } = renderTranscriptPanel();
    const box = layOutLines(1000);
    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    await screen.findByText('Hi! How was your weekend?');
    box.scrollTo(100);
    box.growTo(1300);
    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    await screen.findByText('It was great.');
    expect(box.scrollTop()).toBe(100);

    await userEvent.click(screen.getByRole('button', { name: 'Xuống cuối' }));

    expect(box.scrollTop()).toBe(1100);
    expect(scrollDownButton()).not.toBeInTheDocument();
  });

  it('follows the newest line while the Member stays at the bottom', async () => {
    const { liveKit } = renderTranscriptPanel();
    const box = layOutLines(1000);
    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    await screen.findByText('Hi! How was your weekend?');
    expect(box.scrollTop()).toBe(800);

    box.growTo(1300);
    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    await screen.findByText('It was great.');

    expect(box.scrollTop()).toBe(1100);
    expect(scrollDownButton()).not.toBeInTheDocument();
  });

  it('scrolls to the newest line when it is shown after lines arrived while it was hidden', async () => {
    const { liveKit, show } = renderTranscriptPanel(false);
    const box = layOutLines(1000);
    box.hide();
    box.growTo(1300);
    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    await screen.findByText('Hi! How was your weekend?');
    expect(box.scrollTop()).toBe(0);

    box.show();
    show();

    expect(box.scrollTop()).toBe(1100);
  });
});
