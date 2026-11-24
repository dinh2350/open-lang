import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import {
  allRequestsAnswered,
  roomTokenRequestBodies,
  roomTokensIssued,
  TEST_LIVEKIT_URL,
} from './backend';
import { createUnconnectedRoom } from './unconnected-room';
import { findStatusMessage, getStatusMessage } from './status-message';

/** Renders the Conversation page, with the Agent not yet in the room. */
function renderConversationPage(
  liveKit: ReturnType<typeof createUnconnectedRoom>,
  onEnded: (roomName: string) => void = vi.fn(),
) {
  render(
    <ConversationPage
      room={liveKit.room}
      agentJoinTimeoutMilliseconds={15_000}
      onEnded={onEnded}
    />,
  );
}

/** Presses Bắt đầu. */
async function pressStart(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
}

describe('Conversation page', () => {
  it('shows the Start panel, and nothing to choose, before the Conversation starts', () => {
    renderConversationPage(createUnconnectedRoom());

    expect(
      screen.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('starts a Conversation in the room of a Room Token from the backend when the Member presses Bắt đầu', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);

    await pressStart();

    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Gia sư…');
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('asking for a Room Token sends no participant_metadata', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);

    await pressStart();

    await findStatusMessage();
    expect(roomTokenRequestBodies()).toHaveLength(1);
    expect(roomTokenRequestBodies()[0]).not.toHaveProperty(
      'participant_metadata',
    );
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('status line says Gia sư đang nghe bạn nói.', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Gia sư…');

    act(() => {
      liveKit.agentJoins();
    });
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nghe bạn nói.');

    act(() => {
      liveKit.agentIs('thinking');
    });
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang suy nghĩ.');

    act(() => {
      liveKit.agentIs('speaking');
    });
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nói…');
  });

  it('there is no Chưa nghe kịp button', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await findStatusMessage();

    expect(screen.queryByRole('button', { name: 'Chưa nghe kịp' })).toBeNull();
  });

  it('the in-session screen shows the voice bars, the status and Kết thúc, and no conversation text', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    expect(
      screen.queryByRole('img', { name: 'Giọng nói của Gia sư' }),
    ).not.toBeInTheDocument();
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });

    expect(
      screen.getByRole('img', { name: 'Giọng nói của Gia sư' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Kết thúc']);
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      /^Gia sư đang nghe bạn nói\.Kết thúc$/,
    );
  });

  it('Kết thúc leaves the room and calls onEnded with the room name', async () => {
    const liveKit = createUnconnectedRoom();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    expect(liveKit.room.name).toMatch(/^conversation-/);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(liveKit.room.name);
  });

  it('starts the next Conversation with a new Room Token', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    await pressStart();

    const roomTokensUsed = liveKit
      .connections()
      .map((connection) => connection.participantToken);
    expect(roomTokensUsed).toHaveLength(2);
    expect(new Set(roomTokensUsed).size).toBe(2);
    expect(roomTokensUsed.at(-1)).toBe(roomTokensIssued().at(-1));
  });

  it('requests no Room Token before Bắt đầu, one after it, and one more when Kết thúc ends the Conversation', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await allRequestsAnswered();
    expect(roomTokenRequestBodies()).toHaveLength(0);

    await pressStart();
    await findStatusMessage();
    await allRequestsAnswered();
    expect(roomTokenRequestBodies()).toHaveLength(1);
    act(() => {
      liveKit.agentJoins();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    // Ending a session makes the session fetch the Room Token of the next one.
    await waitFor(() => {
      expect(roomTokenRequestBodies()).toHaveLength(2);
    });
  });

  it('makes one Room Token request and one connection when Bắt đầu is pressed twice', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);

    await userEvent.dblClick(screen.getByRole('button', { name: 'Bắt đầu' }));

    await findStatusMessage();
    await allRequestsAnswered();
    expect(roomTokenRequestBodies()).toHaveLength(1);
    expect(liveKit.connections()).toHaveLength(1);
  });

  it('makes one Room Token request and one connection in React strict mode', async () => {
    const liveKit = createUnconnectedRoom();
    render(
      <StrictMode>
        <ConversationPage
          room={liveKit.room}
          agentJoinTimeoutMilliseconds={15_000}
          onEnded={vi.fn()}
        />
      </StrictMode>,
    );

    await pressStart();

    await findStatusMessage();
    await allRequestsAnswered();
    expect(roomTokenRequestBodies()).toHaveLength(1);
    expect(liveKit.connections()).toHaveLength(1);
  });

  it('end before join returns to the Start panel and starts no navigation', async () => {
    const liveKit = createUnconnectedRoom();
    liveKit.holdConnections();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    await waitFor(() => {
      expect(liveKit.connections()).toHaveLength(1);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(
      await screen.findByRole('button', { name: 'Bắt đầu' }),
    ).toBeVisible();
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("a second Conversation ended before join does not open the first Conversation's Report", async () => {
    const liveKit = createUnconnectedRoom();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    const firstRoom = liveKit.room.name;
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(firstRoom);

    liveKit.holdConnections();
    await pressStart();
    await waitFor(() => {
      expect(liveKit.connections()).toHaveLength(2);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(
      await screen.findByRole('button', { name: 'Bắt đầu' }),
    ).toBeVisible();
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(firstRoom);
  });

  it("an unexpected disconnect after joining opens that Conversation's Report", async () => {
    const liveKit = createUnconnectedRoom();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await findStatusMessage();

    act(() => {
      liveKit.serverDeletesRoom();
    });

    await waitFor(() => {
      expect(onEnded).toHaveBeenCalledExactlyOnceWith(liveKit.room.name);
    });
    expect(liveKit.room.name).toMatch(/^conversation-/);
  });

  it('pressing Kết thúc twice ends once', async () => {
    const liveKit = createUnconnectedRoom();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });

    await userEvent.dblClick(screen.getByRole('button', { name: 'Kết thúc' }));

    await waitFor(() => {
      expect(onEnded).toHaveBeenCalled();
    });
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(liveKit.room.name);
  });
});
