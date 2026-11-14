import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { describe, expect, it } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { createUnconnectedRoom } from './unconnected-room';

describe('Conversation page failures', () => {
  it('explains how to allow the microphone, and starts no Conversation, when microphone access is denied', async () => {
    const liveKit = createUnconnectedRoom();
    liveKit.denyMicrophoneAccess();
    render(<ConversationPage room={liveKit.room} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Allow microphone access for this site',
    );
    await waitFor(() => {
      expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});
