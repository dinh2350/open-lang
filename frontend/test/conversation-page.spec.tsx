import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { describe, expect, it } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { roomTokensIssued, TEST_LIVEKIT_URL } from './backend';
import { createUnconnectedRoom } from './unconnected-room';

describe('Conversation page', () => {
  it('starts a Conversation in the room of a Room Token from the backend when the User presses Start', async () => {
    const liveKit = createUnconnectedRoom();
    render(<ConversationPage room={liveKit.room} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Waiting for the Agent',
    );
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('shows that the Agent has joined once it is listening in the room', async () => {
    const liveKit = createUnconnectedRoom();
    render(<ConversationPage room={liveKit.room} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('Waiting for the Agent…');

    act(() => {
      liveKit.agentJoins();
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'The Agent has joined.',
    );
  });

  it('ends the Conversation and leaves the room when the User presses End', async () => {
    const liveKit = createUnconnectedRoom();
    render(<ConversationPage room={liveKit.room} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      liveKit.agentJoins();
    });

    await userEvent.click(screen.getByRole('button', { name: 'End' }));

    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
  });

  it('starts the next Conversation with a new Room Token', async () => {
    const liveKit = createUnconnectedRoom();
    render(<ConversationPage room={liveKit.room} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await userEvent.click(screen.getByRole('button', { name: 'End' }));

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    const roomTokensUsed = liveKit
      .connections()
      .map((connection) => connection.participantToken);
    expect(roomTokensUsed).toHaveLength(2);
    expect(new Set(roomTokensUsed).size).toBe(2);
    expect(roomTokensUsed.at(-1)).toBe(roomTokensIssued().at(-1));
  });
});
