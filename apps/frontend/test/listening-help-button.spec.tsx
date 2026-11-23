import { RoomContext } from '@livekit/components-react';
import { LISTENING_HELP_MESSAGE } from '@open-lang/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ListeningHelpButton } from '@/conversation/listening-help-button';
import { createUnconnectedRoom } from './unconnected-room';

describe('Listening help button', () => {
  it('sends the listening help message on lk.chat', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <RoomContext value={liveKit.room}>
        <ListeningHelpButton />
      </RoomContext>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Chưa nghe kịp' }),
    );

    expect(liveKit.sendText).toHaveBeenCalledExactlyOnceWith(
      LISTENING_HELP_MESSAGE,
      { topic: 'lk.chat' },
    );
  });
});
