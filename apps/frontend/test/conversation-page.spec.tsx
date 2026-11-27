import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { StrictMode } from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import { NOTES_POLL_MILLISECONDS } from '@/conversation/notes-panel';
import {
  allRequestsAnswered,
  roomTokenRequestBodies,
  roomTokensIssued,
  TEST_LIVEKIT_URL,
} from './backend';
import {
  backendHasNotes,
  noteOf,
  notesRequestsReceived,
} from './conversations-backend';
import { deviceHasWidth } from './device-mode';
import { withQueryClient } from './query-client';
import { createUnconnectedRoom } from './unconnected-room';
import { findStatusMessage, getStatusMessage } from './status-message';

/** Renders the Conversation page, with the Agent not yet in the room. */
function renderConversationPage(
  liveKit: ReturnType<typeof createUnconnectedRoom>,
  onEnded: (roomName: string) => void = vi.fn(),
) {
  render(
    withQueryClient(
      <ConversationPage
        room={liveKit.room}
        agentJoinTimeoutMilliseconds={15_000}
        onEnded={onEnded}
      />,
    ),
  );
}

/** Presses Bắt đầu. */
async function pressStart(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
}

/**
 * Renders the page, presses Bắt đầu, and has the Agent join and listen; the
 * lesson screen is then up, with the side panel closed.
 */
async function startLesson(onEnded: (roomName: string) => void = vi.fn()) {
  const liveKit = createUnconnectedRoom();
  renderConversationPage(liveKit, onEnded);
  await pressStart();
  act(() => {
    liveKit.agentJoins();
  });
  await screen.findByRole('button', { name: 'Tắt mic' });
  return liveKit;
}

/** Whether the side panel with Cuộc nói and Ghi chú is shown. */
function panelIsOpen(): boolean {
  return (
    screen.queryByRole('complementary', { name: 'Cuộc nói và ghi chú' }) !==
    null
  );
}

/** The Badge on the Ghi chú button that shows `count`. */
function noteCountBadge(count: string): HTMLElement {
  const button = screen.getByRole('button', { name: /^Ghi chú/ });
  const badge = within(button).getByText(count).closest('[data-variant]');
  if (!(badge instanceof HTMLElement)) {
    throw new Error(`no badge with ${count} on Ghi chú`);
  }
  return badge;
}

/** The next poll of the Notes: two seconds pass, and the backend answers. */
async function nextPoll(): Promise<void> {
  const requestsBefore = notesRequestsReceived().length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(NOTES_POLL_MILLISECONDS);
  });
  await waitFor(() => {
    expect(notesRequestsReceived()).toHaveLength(requestsBefore + 1);
  });
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

  it('status line says the tutor waits for the mic while it is off', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    );
    await screen.findByText('Mic đang tắt. Gia sư không nghe thấy bạn.');

    expect(screen.getByText('Gia sư đang chờ bạn bật mic.')).toBeVisible();
    expect(screen.queryByText('Gia sư đang nghe bạn nói.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    expect(await screen.findByText('Gia sư đang nghe bạn nói.')).toBeVisible();
    expect(screen.queryByText('Gia sư đang chờ bạn bật mic.')).toBeNull();
  });

  it('status line keeps waiting for the mic when the browser refuses it', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    );
    await screen.findByText('Mic đang tắt. Gia sư không nghe thấy bạn.');
    liveKit.setMicrophoneEnabled.mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Bật mic' }));

    await screen.findByRole('alert');
    expect(screen.getByText('Gia sư đang chờ bạn bật mic.')).toBeVisible();
    expect(screen.queryByText('Gia sư đang nghe bạn nói.')).toBeNull();
  });

  it('has Tắt mic and Kết thúc and no Chưa nghe kịp', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await findStatusMessage();

    expect(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kết thúc' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Chưa nghe kịp' })).toBeNull();
  });

  it('ends the session while muted', async () => {
    const liveKit = createUnconnectedRoom();
    const onEnded = vi.fn();
    renderConversationPage(liveKit, onEnded);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Tắt mic' }),
    );
    expect(
      await screen.findByText('Mic đang tắt. Gia sư không nghe thấy bạn.'),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(liveKit.room.name);
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu' }),
    ).toBeVisible();
  });

  it('the lesson screen starts with only the aura, the status line and the controls', async () => {
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
    expect(await findStatusMessage()).toHaveTextContent(
      'Gia sư đang nghe bạn nói.',
    );
    expect(
      (await screen.findAllByRole('button')).map(
        (button) => button.textContent,
      ),
    ).toEqual(['Tắt mic', 'Cuộc nói', 'Ghi chú', 'Kết thúc']);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('heading')).toEqual([]);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(
      screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.'),
    ).not.toBeVisible();
  });

  it('Cuộc nói opens the transcript and Ghi chú opens the notes, and each button closes its own tab', async () => {
    backendHasNotes('conversation-1', [noteOf('phrase', 'That makes sense.')]);
    await startLesson();
    const transcriptButton = screen.getByRole('button', { name: 'Cuộc nói' });
    const notesButton = screen.getByRole('button', { name: /^Ghi chú/ });
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'false');
    expect(notesButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(transcriptButton);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'true');
    expect(notesButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('tab', { name: 'Cuộc nói' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.')).toBeVisible();
    expect(await screen.findByText('That makes sense.')).not.toBeVisible();

    await userEvent.click(notesButton);
    expect(notesButton).toHaveAttribute('aria-expanded', 'true');
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('tab', { name: /^Ghi chú/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('That makes sense.')).toBeVisible();
    expect(
      screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.'),
    ).not.toBeVisible();

    await userEvent.click(notesButton);
    expect(notesButton).toHaveAttribute('aria-expanded', 'false');
    expect(panelIsOpen()).toBe(false);
    expect(screen.getByText('That makes sense.')).not.toBeVisible();

    await userEvent.click(transcriptButton);
    await userEvent.click(transcriptButton);
    expect(transcriptButton).toHaveAttribute('aria-expanded', 'false');
    expect(panelIsOpen()).toBe(false);
    expect(
      screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.'),
    ).not.toBeVisible();
  });

  it('pressing the tab that is already selected keeps the panel open', async () => {
    await startLesson();
    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));

    expect(panelIsOpen()).toBe(true);
    expect(screen.getByRole('tab', { name: 'Cuộc nói' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.')).toBeVisible();

    // The other tab still switches.
    await userEvent.click(screen.getByRole('tab', { name: /^Ghi chú/ }));
    expect(screen.getByRole('button', { name: /^Ghi chú/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(panelIsOpen()).toBe(true);
  });

  it('keeps the lines said while the panel is closed', async () => {
    const device = deviceHasWidth(1024);
    const liveKit = await startLesson();
    act(() => {
      liveKit.agentSays('segment-1', 'Hi! How was your weekend?');
    });
    act(() => {
      liveKit.memberSays('segment-2', 'It was great.');
    });
    const transcriptIsThere = () => {
      expect(screen.getByText('Hi! How was your weekend?')).toBeVisible();
      expect(screen.getByText('It was great.')).toBeVisible();
    };

    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    transcriptIsThere();

    // Closed and opened again.
    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    expect(screen.getByText('It was great.')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    transcriptIsThere();

    // Switched to Ghi chú and back.
    await userEvent.click(screen.getByRole('tab', { name: /^Ghi chú/ }));
    expect(screen.getByText('It was great.')).not.toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));
    transcriptIsThere();

    // A phone turned upright, then sideways again.
    act(() => {
      device.resize(375);
      globalThis.dispatchEvent(new Event('resize'));
    });
    transcriptIsThere();
    act(() => {
      device.resize(1024);
      globalThis.dispatchEvent(new Event('resize'));
    });
    transcriptIsThere();
  });

  it('shows the count of notes on Ghi chú before the panel is opened', async () => {
    backendHasNotes('conversation-1', [
      noteOf('phrase', 'That makes sense.'),
      noteOf('word', 'run by'),
    ]);
    await startLesson();

    const notesButton = await screen.findByRole('button', {
      name: /^Ghi chú/,
    });
    expect(await within(notesButton).findByText('2')).toBeVisible();
    expect(notesButton).toHaveAttribute('aria-expanded', 'false');
    expect(panelIsOpen()).toBe(false);
  });

  it('marks new notes while the panel is closed, and clears the mark when the Ghi chú tab is shown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    backendHasNotes('conversation-1', [noteOf('phrase', 'That makes sense.')]);
    await startLesson();

    // A note arrived while the panel was closed.
    await waitFor(() => {
      expect(noteCountBadge('1')).toHaveAttribute('data-variant', 'blue');
    });

    // The transcript does not show the notes, so the mark stays.
    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    expect(noteCountBadge('1')).toHaveAttribute('data-variant', 'blue');

    // The Ghi chú tab is shown: the mark clears, and stays clear once closed.
    await userEvent.click(screen.getByRole('tab', { name: /^Ghi chú/ }));
    expect(noteCountBadge('1')).toHaveAttribute('data-variant', 'neutral');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(noteCountBadge('1')).toHaveAttribute('data-variant', 'neutral');

    // A new note arrives while the panel is closed: marked again.
    backendHasNotes('conversation-1', [
      noteOf('phrase', 'That makes sense.'),
      noteOf('word', 'run by'),
    ]);
    await nextPoll();
    await waitFor(() => {
      expect(noteCountBadge('2')).toHaveAttribute('data-variant', 'blue');
    });

    await userEvent.click(screen.getByRole('button', { name: /^Ghi chú/ }));
    expect(noteCountBadge('2')).toHaveAttribute('data-variant', 'neutral');
    expect(screen.getByText('run by')).toBeVisible();
  });

  it('the controls stay usable while the panel is open', async () => {
    const onEnded = vi.fn();
    const liveKit = await startLesson(onEnded);
    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    expect(panelIsOpen()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));

    expect(liveKit.microphoneIsOn()).toBe(false);
    expect(
      await screen.findByRole('button', { name: 'Bật mic' }),
    ).toBeVisible();
    expect(
      screen.getByText('Mic đang tắt. Gia sư không nghe thấy bạn.'),
    ).toBeVisible();
    expect(screen.getByText('Gia sư đang chờ bạn bật mic.')).toBeVisible();
    expect(panelIsOpen()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    expect(liveKit.room.state).toBe(ConnectionState.Disconnected);
    expect(onEnded).toHaveBeenCalledExactlyOnceWith(liveKit.room.name);
  });

  it('Escape and Đóng close the panel', async () => {
    await startLesson();
    await userEvent.click(screen.getByRole('button', { name: /^Ghi chú/ }));
    expect(panelIsOpen()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(panelIsOpen()).toBe(false);
    expect(screen.getByRole('button', { name: /^Ghi chú/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));
    await userEvent.keyboard('{Escape}');
    expect(panelIsOpen()).toBe(false);
    expect(screen.getByRole('button', { name: 'Cuộc nói' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('gives the focus back to the button of the panel that was open when the panel closes', async () => {
    await startLesson();
    const transcriptButton = screen.getByRole('button', { name: 'Cuộc nói' });
    const notesButton = screen.getByRole('button', { name: /^Ghi chú/ });

    // Đóng, from Ghi chú.
    await userEvent.click(notesButton);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(notesButton).toHaveFocus();

    // Escape, after switching from Cuộc nói to Ghi chú inside the panel.
    await userEvent.click(transcriptButton);
    await userEvent.click(screen.getByRole('tab', { name: /^Ghi chú/ }));
    await userEvent.keyboard('{Escape}');
    expect(notesButton).toHaveFocus();

    // Escape, from Cuộc nói.
    await userEvent.click(transcriptButton);
    await userEvent.click(screen.getByRole('tab', { name: 'Cuộc nói' }));
    await userEvent.keyboard('{Escape}');
    expect(transcriptButton).toHaveFocus();

    // The panel's own button keeps the focus.
    await userEvent.click(transcriptButton);
    await userEvent.click(transcriptButton);
    expect(transcriptButton).toHaveFocus();
  });

  it('the lesson works when WebGL is not available', async () => {
    const liveKit = await startLesson();

    await waitFor(() => {
      expect(document.querySelector('.aura-fallback')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('img', { name: 'Giọng nói của Gia sư' }),
    ).toBeVisible();
    expect(getStatusMessage()).toHaveTextContent('Gia sư đang nghe bạn nói.');

    await userEvent.click(screen.getByRole('button', { name: 'Cuộc nói' }));
    expect(screen.getByText('Chữ của cuộc nói sẽ hiện ở đây.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tắt mic' }));
    expect(liveKit.microphoneIsOn()).toBe(false);
    expect(
      await screen.findByRole('button', { name: 'Bật mic' }),
    ).toBeVisible();
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
        {withQueryClient(
          <ConversationPage
            room={liveKit.room}
            agentJoinTimeoutMilliseconds={15_000}
            onEnded={vi.fn()}
          />,
        )}
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
