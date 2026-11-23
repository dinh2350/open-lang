import { Banner } from '@astryxdesign/core/Banner';
import { Stack } from '@astryxdesign/core/Stack';
import type { ConversationChoice } from '@open-lang/shared';
import type { Room } from 'livekit-client';
import { useRef, useState } from 'react';
import {
  type ConversationFailure,
  ConversationSession,
} from './conversation-session';
import { ScenarioPicker } from './scenario-picker';

interface ConversationPageProps {
  /** The LiveKit Room each Conversation connects through, one at a time. */
  readonly room: Room;
  /**
   * How long a Conversation waits for the Agent to join and start listening
   * before it shows "Agent không sẵn sàng" and ends.
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
    'Agent không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bắt đầu.',
  'start-failed': 'Không bắt đầu được buổi luyện. Bấm Bắt đầu để thử lại.',
  'agent-unavailable':
    'Agent không sẵn sàng nên buổi luyện đã kết thúc. Bấm Bắt đầu để thử lại.',
};

/** The Conversation that is running, or has just failed. */
interface Attempt {
  /** Tells a new Conversation from the last, even with the same choice. */
  readonly id: number;
  readonly choice: ConversationChoice;
}

/**
 * The Member chooses a Scenario and a speed and presses Bắt đầu to begin a
 * Conversation in a new private room; Kết thúc leaves it. The Conversation's
 * session exists only from Bắt đầu on, so nothing asks for a Room Token before.
 */
export function ConversationPage({
  room,
  agentJoinTimeoutMilliseconds,
  onEnded,
}: ConversationPageProps) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [lastChoice, setLastChoice] = useState<ConversationChoice>();
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
  // Set from the press until the Conversation fails or ends, so a second
  // press cannot start a second Conversation, even before the next render.
  const running = useRef(false);

  function start(choice: ConversationChoice): void {
    if (running.current) {
      return;
    }
    running.current = true;
    setFailure(null);
    setLastChoice(choice);
    setAttempt((previous) => ({ id: (previous?.id ?? 0) + 1, choice }));
  }

  function fail(reason: ConversationFailure): void {
    running.current = false;
    setFailure(reason);
  }

  function end(roomName: string): void {
    running.current = false;
    setAttempt(null);
    onEnded(roomName);
  }

  return (
    <Stack
      as="main"
      align="center"
      justify="center"
      gap={6}
      padding={6}
      minHeight="100svh"
    >
      {failure !== null && (
        <Banner status="error" role="alert" title={failureMessages[failure]} />
      )}
      {attempt !== null && (
        <ConversationSession
          key={attempt.id}
          room={room}
          choice={attempt.choice}
          agentJoinTimeoutMilliseconds={agentJoinTimeoutMilliseconds}
          onFailed={fail}
          onEnded={end}
        />
      )}
      {(attempt === null || failure !== null) && (
        <ScenarioPicker onStart={start} initialChoice={lastChoice} />
      )}
    </Stack>
  );
}
