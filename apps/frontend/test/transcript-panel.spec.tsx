import { RoomContext } from '@livekit/components-react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranscriptPanel } from '@/conversation/transcript-panel';
import { createUnconnectedRoom } from './unconnected-room';

/** TranscriptPanel in a room the Member and the Agent joined. */
function renderTranscriptPanel() {
  const liveKit = createUnconnectedRoom();
  liveKit.joins();
  liveKit.agentJoins();
  render(
    <RoomContext value={liveKit.room}>
      <TranscriptPanel />
    </RoomContext>,
  );
  return liveKit;
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
    const liveKit = renderTranscriptPanel();

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
    const liveKit = renderTranscriptPanel();

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
    const liveKit = renderTranscriptPanel();
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
});
