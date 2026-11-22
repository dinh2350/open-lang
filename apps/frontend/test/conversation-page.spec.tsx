import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { describe, expect, it } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { roomTokensIssued, TEST_LIVEKIT_URL } from './backend';
import { createUnconnectedRoom } from './unconnected-room';
import {
  findStatusMessage,
  getStatusMessage,
  queryStatusMessage,
} from './status-message';

describe('Conversation page', () => {
  it('starts a Conversation in the room of a Room Token from the backend when the User presses Start', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await findStatusMessage()).toHaveTextContent(
      'Waiting for the Agent',
    );
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('shows that the Agent is listening once it joins the room', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByText('Waiting for the Agent…');

    act(() => {
      liveKit.agentJoins();
    });

    expect(getStatusMessage()).toHaveTextContent('The Agent is listening.');
  });

  it.each(['thinking', 'speaking'] as const)(
    'shows that the Agent is %s',
    async (agentState) => {
      const liveKit = createUnconnectedRoom();
      render(
        <ConversationPage
          room={liveKit.room}
          agentJoinTimeoutMilliseconds={15_000}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));
      act(() => {
        liveKit.agentJoins();
      });

      act(() => {
        liveKit.agentIs(agentState);
      });

      expect(getStatusMessage()).toHaveTextContent(
        `The Agent is ${agentState}.`,
      );
    },
  );

  it("shows a visualizer of the Agent's voice during a Conversation", async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );
    expect(
      screen.queryByRole('img', { name: "The Agent's voice" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      liveKit.agentJoins();
    });

    expect(
      screen.getByRole('img', { name: "The Agent's voice" }),
    ).toBeVisible();
  });

  it('mutes the microphone when the User presses Mute microphone, and unmutes it when they press it again', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      liveKit.agentJoins();
    });
    const muteToggle = screen.getByRole('button', {
      name: 'Mute microphone',
      pressed: false,
    });
    expect(liveKit.room.localParticipant.isMicrophoneEnabled).toBe(true);

    await userEvent.click(muteToggle);

    expect(muteToggle).toHaveAttribute('aria-pressed', 'true');
    expect(liveKit.room.localParticipant.isMicrophoneEnabled).toBe(false);

    await userEvent.click(muteToggle);

    expect(muteToggle).toHaveAttribute('aria-pressed', 'false');
    expect(liveKit.room.localParticipant.isMicrophoneEnabled).toBe(true);
  });

  it('ends the Conversation and leaves the room when the User presses End', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      liveKit.agentJoins();
    });

    await userEvent.click(screen.getByRole('button', { name: 'End' }));

    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(queryStatusMessage()).toBeNull();
    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
  });

  it('starts the next Conversation with a new Room Token', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
      />,
    );
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
