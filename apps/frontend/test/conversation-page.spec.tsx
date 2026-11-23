import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '@/conversation/conversation-page';
import {
  roomTokenRequestParticipantMetadata,
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

/** Presses Bắt đầu with the first Scenario and "Vừa" selected. */
async function pressStart(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
}

describe('Conversation page', () => {
  it('lets the Member choose a Scenario and a speed before the Conversation starts', () => {
    renderConversationPage(createUnconnectedRoom());

    expect(
      screen.getByRole('heading', { name: 'Luyện nói hôm nay' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Chưa nghe kịp' }),
    ).not.toBeInTheDocument();
  });

  it('starts a Conversation in the room of a Room Token from the backend when the Member presses Bắt đầu', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);

    await pressStart();

    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Sam…');
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('Bắt đầu requests a Room Token whose participant_metadata carries the chosen Scenario and speed', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Họp 1:1 với quản lý' }),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Chậm' }));
    await pressStart();

    await findStatusMessage();
    const metadata = roomTokenRequestParticipantMetadata().at(-1);
    expect(JSON.parse(metadata ?? 'null')).toEqual({
      scenarioId: 'one-on-one',
      speed: 0.7,
    });
    expect(liveKit.connections()).toEqual([
      {
        serverUrl: TEST_LIVEKIT_URL,
        participantToken: roomTokensIssued().at(-1),
      },
    ]);
  });

  it('shows the persona of the chosen Scenario in the status line', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Gọi khách trễ hạn' }),
    );
    await pressStart();

    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Jordan…');
  });

  it("shows the persona's name in the status line for each Agent state", async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Sam…');

    act(() => {
      liveKit.agentJoins();
    });
    expect(getStatusMessage()).toHaveTextContent('Sam đang nghe bạn nói.');

    act(() => {
      liveKit.agentIs('thinking');
    });
    expect(getStatusMessage()).toHaveTextContent('Sam đang suy nghĩ.');

    act(() => {
      liveKit.agentIs('speaking');
    });
    expect(getStatusMessage()).toHaveTextContent('Sam đang nói…');
  });

  it('the in-session screen shows the voice bars and two buttons and no conversation text', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    expect(
      screen.queryByRole('img', { name: 'Giọng nói của Sam' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Chậm' }));
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });

    expect(
      screen.getByRole('img', { name: 'Giọng nói của Sam' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Chưa nghe kịp', 'Kết thúc']);
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      /^Họp standup · tốc độ chậmSam đang nghe bạn nói\.Chưa nghe kịpKết thúc$/,
    );
  });

  it('sends the listening help message to the Agent when the Member presses Chưa nghe kịp', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    act(() => {
      liveKit.agentJoins();
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Chưa nghe kịp' }),
    );

    expect(liveKit.sendText).toHaveBeenCalledExactlyOnceWith('listening-help', {
      topic: 'lk.chat',
    });
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

  it('starts the next Conversation with the next choice of Scenario and speed', async () => {
    const liveKit = createUnconnectedRoom();
    renderConversationPage(liveKit);
    await pressStart();
    await userEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Họp 1:1 với quản lý' }),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Bình thường' }));
    await pressStart();

    expect(await findStatusMessage()).toHaveTextContent('Đang chờ Alex…');
    expect(
      JSON.parse(roomTokenRequestParticipantMetadata().at(-1) ?? 'null'),
    ).toEqual({ scenarioId: 'one-on-one', speed: 1 });
    expect(liveKit.connections().at(-1)?.participantToken).toBe(
      roomTokensIssued().at(-1),
    );
  });
});
