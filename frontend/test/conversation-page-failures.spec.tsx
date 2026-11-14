import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { backend } from './backend';
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

  it.each([
    ['a network error', () => HttpResponse.error()],
    [
      'a 503 response',
      () =>
        HttpResponse.json({ message: 'Service Unavailable' }, { status: 503 }),
    ],
  ])(
    'shows an error, and offers Start again, when the Room Token request fails with %s',
    async (_failure, respond) => {
      backend.use(http.post('/api/token', respond));
      const liveKit = createUnconnectedRoom();
      render(<ConversationPage room={liveKit.room} />);

      await userEvent.click(screen.getByRole('button', { name: 'Start' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't start the Conversation",
      );
      expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
      expect(liveKit.connections()).toEqual([]);
    },
  );
});
