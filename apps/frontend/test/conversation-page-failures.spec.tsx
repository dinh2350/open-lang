import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { backend, roomTokensIssued } from './backend';
import { withQueryClient } from './query-client';
import { createUnconnectedRoom } from './unconnected-room';
import {
  findStatusMessage,
  getStatusMessage,
  queryStatusMessage,
} from './status-message';

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
    render(
      withQueryClient(
        <ConversationPage
          room={liveKit.room}
          agentJoinTimeoutMilliseconds={15_000}
          onEnded={vi.fn()}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gia sư không nghe được bạn vì quyền dùng micro đang bị chặn',
    );
    await waitFor(() => {
      expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    });
    expect(queryStatusMessage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
  });

  it.each([
    ['a network error', () => HttpResponse.error()],
    [
      'a 503 response',
      () =>
        HttpResponse.json({ message: 'Service Unavailable' }, { status: 503 }),
    ],
  ])(
    'shows an error, and offers Bắt đầu again, when the Room Token request fails with %s',
    async (_failure, respond) => {
      backend.use(http.post('/api/token', respond));
      const liveKit = createUnconnectedRoom();
      render(
        withQueryClient(
          <ConversationPage
            room={liveKit.room}
            agentJoinTimeoutMilliseconds={15_000}
            onEnded={vi.fn()}
          />,
        ),
      );

      await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Không bắt đầu được buổi học',
      );
      expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
      expect(liveKit.connections()).toEqual([]);
    },
  );

  it('shows that the Agent is unavailable, and ends the Conversation, when the Agent has not joined 15 seconds after Bắt đầu', async () => {
    const user = startFakeTimers();
    const liveKit = createUnconnectedRoom();
    render(
      withQueryClient(
        <ConversationPage
          room={liveKit.room}
          agentJoinTimeoutMilliseconds={15_000}
          onEnded={vi.fn()}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    await screen.findByText('Đang chờ Gia sư…');

    await act(() => vi.advanceTimersByTimeAsync(14_000));
    expect(getStatusMessage()).toHaveTextContent('Đang chờ Gia sư');

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Gia sư không sẵn sàng',
    );
    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    expect(queryStatusMessage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
  });

  it('waits for the Agent as long as the frontend configures', async () => {
    const user = startFakeTimers();
    const liveKit = createUnconnectedRoom();
    render(
      withQueryClient(
        <ConversationPage
          room={liveKit.room}
          agentJoinTimeoutMilliseconds={5_000}
          onEnded={vi.fn()}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Bắt đầu' }));
    await screen.findByText('Đang chờ Gia sư…');

    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Gia sư không sẵn sàng',
    );
  });

  describe('pressing Bắt đầu again', () => {
    it('starts a fresh attempt with a new Room Token once the User allows the microphone', async () => {
      const liveKit = createUnconnectedRoom();
      liveKit.denyMicrophoneAccess();
      render(
        withQueryClient(
          <ConversationPage
            room={liveKit.room}
            agentJoinTimeoutMilliseconds={15_000}
            onEnded={vi.fn()}
          />,
        ),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
      await screen.findByRole('alert');

      liveKit.allowMicrophoneAccess();
      await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

      expect(await findStatusMessage()).toHaveTextContent('Đang chờ Gia sư');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const [failedAttempt, freshAttempt] = roomTokensUsed(liveKit);
      expect(freshAttempt).toBe(roomTokensIssued().at(-1));
      expect(freshAttempt).not.toBe(failedAttempt);
    });

    it('starts a fresh attempt with a new Room Token once the backend issues Room Tokens again', async () => {
      backend.use(http.post('/api/token', () => HttpResponse.error()));
      const liveKit = createUnconnectedRoom();
      render(
        withQueryClient(
          <ConversationPage
            room={liveKit.room}
            agentJoinTimeoutMilliseconds={15_000}
            onEnded={vi.fn()}
          />,
        ),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
      await screen.findByRole('alert');

      backend.resetHandlers();
      await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

      expect(await findStatusMessage()).toHaveTextContent('Đang chờ Gia sư');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(roomTokensUsed(liveKit)).toEqual([roomTokensIssued().at(-1)]);
    });

    it('starts a fresh attempt with a new Room Token, which the Agent can join, after the Agent was unavailable', async () => {
      const user = startFakeTimers();
      const liveKit = createUnconnectedRoom();
      render(
        withQueryClient(
          <ConversationPage
            room={liveKit.room}
            agentJoinTimeoutMilliseconds={15_000}
            onEnded={vi.fn()}
          />,
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Bắt đầu' }));
      await act(() => vi.advanceTimersByTimeAsync(15_000));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Gia sư không sẵn sàng',
      );

      await user.click(screen.getByRole('button', { name: 'Bắt đầu' }));
      await screen.findByText('Đang chờ Gia sư…');
      act(() => {
        liveKit.agentJoins();
      });

      expect(getStatusMessage()).toHaveTextContent('Gia sư đang nghe bạn nói.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      const [failedAttempt, freshAttempt] = roomTokensUsed(liveKit);
      expect(freshAttempt).toBe(roomTokensIssued().at(-1));
      expect(freshAttempt).not.toBe(failedAttempt);
    });
  });
});
