import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { backend, roomTokensIssued } from './backend';
import { createUnconnectedRoom } from './unconnected-room';

/** The Room Tokens of every room the Room connected to, oldest first. */
function roomTokensUsed(
  liveKit: ReturnType<typeof createUnconnectedRoom>,
): string[] {
  return liveKit.connections().map((connection) => connection.participantToken);
}

/** Fake timers for the current test, and a User whose typing follows them. */
function startFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

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

  it('shows that the Agent is unavailable, and ends the Conversation, when the Agent has not joined 15 seconds after Start', async () => {
    const user = startFakeTimers();
    const liveKit = createUnconnectedRoom();
    render(<ConversationPage room={liveKit.room} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('Waiting for the Agent…');

    await act(() => vi.advanceTimersByTimeAsync(14_000));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for the Agent',
    );

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.getByRole('alert')).toHaveTextContent('Agent unavailable');
    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  it('waits for the Agent as long as the frontend configures', async () => {
    const user = startFakeTimers();
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={5_000}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('Waiting for the Agent…');

    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(screen.getByRole('alert')).toHaveTextContent('Agent unavailable');
  });

  describe('pressing Start again', () => {
    it('starts a fresh attempt with a new Room Token once the User allows the microphone', async () => {
      const liveKit = createUnconnectedRoom();
      liveKit.denyMicrophoneAccess();
      render(<ConversationPage room={liveKit.room} />);
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));
      await screen.findByRole('alert');

      liveKit.allowMicrophoneAccess();
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Waiting for the Agent',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const [failedAttempt, freshAttempt] = roomTokensUsed(liveKit);
      expect(freshAttempt).toBe(roomTokensIssued().at(-1));
      expect(freshAttempt).not.toBe(failedAttempt);
    });

    it('starts a fresh attempt with a new Room Token once the backend issues Room Tokens again', async () => {
      backend.use(http.post('/api/token', () => HttpResponse.error()));
      const liveKit = createUnconnectedRoom();
      render(<ConversationPage room={liveKit.room} />);
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));
      await screen.findByRole('alert');

      backend.resetHandlers();
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Waiting for the Agent',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(roomTokensUsed(liveKit)).toEqual([roomTokensIssued().at(-1)]);
    });

    it('starts a fresh attempt with a new Room Token, which the Agent can join, after the Agent was unavailable', async () => {
      const user = startFakeTimers();
      const liveKit = createUnconnectedRoom();
      render(<ConversationPage room={liveKit.room} />);
      await user.click(screen.getByRole('button', { name: 'Start' }));
      await act(() => vi.advanceTimersByTimeAsync(15_000));
      expect(screen.getByRole('alert')).toHaveTextContent('Agent unavailable');

      await user.click(screen.getByRole('button', { name: 'Start' }));
      await screen.findByText('Waiting for the Agent…');
      act(() => {
        liveKit.agentJoins();
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        'The Agent is listening.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const [failedAttempt, freshAttempt] = roomTokensUsed(liveKit);
      expect(freshAttempt).toBe(roomTokensIssued().at(-1));
      expect(freshAttempt).not.toBe(failedAttempt);
    });
  });
});
