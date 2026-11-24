import { RoomContext } from '@livekit/components-react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MicToggle } from '@/conversation/mic-toggle';
import { createUnconnectedRoom } from './unconnected-room';
import { queryStatusMessage } from './status-message';

const MUTED = 'Mic đang tắt. Gia sư không nghe thấy bạn.';

/** MicToggle in a room the Member joined with the microphone on. */
async function renderMicToggle() {
  const liveKit = createUnconnectedRoom();
  liveKit.joins();
  await liveKit.room.localParticipant.setMicrophoneEnabled(true);
  render(
    <RoomContext value={liveKit.room}>
      <MicToggle />
    </RoomContext>,
  );
  return liveKit;
}

describe('MicToggle', () => {
  it('mutes the microphone and says so', async () => {
    const liveKit = await renderMicToggle();
    expect(queryStatusMessage()).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));

    expect(liveKit.setMicrophoneEnabled.mock.lastCall?.[0]).toBe(false);
    expect(liveKit.microphoneIsOn()).toBe(false);
    expect(
      await screen.findByRole('button', { name: 'Bật mic' }),
    ).toBeVisible();
    expect(queryStatusMessage()).toHaveTextContent(MUTED);
  });

  it('unmutes', async () => {
    const liveKit = await renderMicToggle();
    await userEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Bật mic' }),
    );

    expect(liveKit.setMicrophoneEnabled.mock.lastCall?.[0]).toBe(true);
    expect(liveKit.microphoneIsOn()).toBe(true);
    expect(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    ).toBeVisible();
    expect(queryStatusMessage()).toBeNull();
  });

  it('says nothing about the mic once the room is left', async () => {
    const liveKit = await renderMicToggle();

    await act(async () => {
      await liveKit.room.disconnect();
    });

    expect(liveKit.microphoneIsOn()).toBe(false);
    expect(queryStatusMessage()).toBeNull();
  });
});
