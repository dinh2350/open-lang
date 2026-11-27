import { Banner } from '@astryxdesign/core/Banner';
import { Stack } from '@astryxdesign/core/Stack';
import type { Room } from 'livekit-client';
import { useRef, useState } from 'react';
import {
  type ConversationFailure,
  ConversationSession,
} from './conversation-session';
import { StartPanel } from './start-panel';

interface ConversationPageProps {
  /** The LiveKit Room each Conversation connects through, one at a time. */
  readonly room: Room;
  /**
   * How long a Conversation waits for the Agent to join and start listening
   * before it shows "Gia sư không sẵn sàng" and ends.
   */
  readonly agentJoinTimeoutMilliseconds: number;
  /**
   * Called with the name of the Conversation's Room once the Member ended the
   * Conversation and left the Room.
   */
  readonly onEnded: (roomName: string) => void;
}

const failureMessages: Record<ConversationFailure, string> = {
  'microphone-denied':
    'Gia sư không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bắt đầu.',
  'start-failed': 'Không bắt đầu được buổi học. Bấm Bắt đầu để thử lại.',
  'agent-unavailable':
    'Gia sư không sẵn sàng nên buổi học đã kết thúc. Bấm Bắt đầu để thử lại.',
};

/**
 * The Member presses Bắt đầu to begin a Conversation with the tutor in a new
 * private room; Kết thúc leaves it. The Conversation's session exists only
 * from Bắt đầu on, so nothing asks for a Room Token before.
 */
export function ConversationPage({
  room,
  agentJoinTimeoutMilliseconds,
  onEnded,
}: ConversationPageProps) {
  // The Conversation that is running, or has just failed; a new number tells
  // a new Conversation from the last.
  const [attempt, setAttempt] = useState<number | null>(null);
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
  // Set from the press until the Conversation fails or ends, so a second
  // press cannot start a second Conversation, even before the next render.
  const running = useRef(false);

  function start(): void {
    if (running.current) {
      return;
    }
    running.current = true;
    setFailure(null);
    setAttempt((previous) => (previous ?? 0) + 1);
  }

  function fail(reason: ConversationFailure): void {
    running.current = false;
    setFailure(reason);
  }

  /** A Conversation that never joined its room has no Report to show. */
  function end(roomName: string | null): void {
    running.current = false;
    setAttempt(null);
    if (roomName !== null) {
      onEnded(roomName);
    }
  }

  // The running Conversation fills the screen itself; the Start panel, and
  // the alert of a Conversation that failed, are centred.
  return (
    <main>
      {attempt !== null && (
        <ConversationSession
          key={attempt}
          room={room}
          agentJoinTimeoutMilliseconds={agentJoinTimeoutMilliseconds}
          onFailed={fail}
          onEnded={end}
        />
      )}
      {(attempt === null || failure !== null) && (
        <Stack
          align="center"
          justify="center"
          gap={6}
          padding={6}
          minHeight="100%"
        >
          {failure !== null && (
            <Banner
              status="error"
              role="alert"
              title={failureMessages[failure]}
            />
          )}
          <StartPanel onStart={start} />
        </Stack>
      )}
    </main>
  );
}
