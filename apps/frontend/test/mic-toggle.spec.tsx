import { RoomContext } from '@livekit/components-react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

/** The Member turns the mic off, and the next attempt to turn it on fails. */
async function renderMutedMicThatFails(error: unknown) {
  const liveKit = await renderMicToggle();
  await userEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));
  await screen.findByRole('button', { name: 'Bật mic' });
  liveKit.setMicrophoneEnabled.mockRejectedValueOnce(error);
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

  it('says the microphone is blocked when the browser refuses it', async () => {
    const liveKit = await renderMutedMicThatFails(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gia sư không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bật mic.',
    );
    expect(screen.getByRole('button', { name: 'Bật mic' })).toBeVisible();
    expect(liveKit.microphoneIsOn()).toBe(false);

    // The Member allowed the microphone: the next press turns it on.
    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    expect(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    ).toBeVisible();
    expect(liveKit.microphoneIsOn()).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says no microphone was found when there is none', async () => {
    await renderMutedMicThatFails(
      new DOMException('Requested device not found', 'NotFoundError'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy micro. Hãy cắm micro, rồi bấm Bật mic.',
    );
    expect(screen.getByRole('button', { name: 'Bật mic' })).toBeVisible();
  });

  it('says the mic could not be turned on, and logs why, on any other failure', async () => {
    const error = new Error('The track could not be published');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await renderMutedMicThatFails(error);

    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không bật được mic. Hãy thử lại.',
    );
    expect(screen.getByRole('button', { name: 'Bật mic' })).toBeVisible();
    expect(consoleError).toHaveBeenCalledWith(
      'The microphone could not be switched:',
      error,
    );
  });
});
