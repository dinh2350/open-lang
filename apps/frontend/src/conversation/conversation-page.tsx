import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Stack } from '@astryxdesign/core/Stack';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from '@livekit/components-react';
import {
  type ConversationChoice,
  DEFAULT_SPEED,
  SCENARIO_IDS,
  SCENARIOS,
  SPEED_LABELS,
} from '@open-lang/shared';
import { ConnectionState, MediaDeviceFailure, type Room } from 'livekit-client';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AgentStatus } from './agent-status';
import { ListeningHelpButton } from './listening-help-button';
import { createRoomTokenSource } from './room-token-source';
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

type ConversationFailure =
  'microphone-denied' | 'start-failed' | 'agent-unavailable';

const failureMessages: Record<ConversationFailure, string> = {
  'microphone-denied':
    'Agent không nghe được bạn vì quyền dùng micro đang bị chặn. Hãy cho phép micro cho trang này trong cài đặt trình duyệt, rồi bấm Bắt đầu.',
  'start-failed': 'Không bắt đầu được buổi luyện. Bấm Bắt đầu để thử lại.',
  'agent-unavailable':
    'Agent không sẵn sàng nên buổi luyện đã kết thúc. Bấm Bắt đầu để thử lại.',
};

/**
 * What the Room Token prepared on page load carries, before the Member has
 * chosen: the first Scenario at the default speed. The Conversation itself
 * always uses a Room Token for the Member's own choice.
 */
const PREPARED_CHOICE: ConversationChoice = {
  scenarioId: SCENARIO_IDS[0],
  speed: DEFAULT_SPEED,
};

/**
 * Why Start failed: the Member denied the microphone, or something else went
 * wrong, which is logged for developers.
 */
function startFailure(error: unknown): ConversationFailure {
  if (
    MediaDeviceFailure.getFailure(error) === MediaDeviceFailure.PermissionDenied
  ) {
    return 'microphone-denied';
  }
  console.error('The Conversation failed to start:', error);
  return 'start-failed';
}

/**
 * The Member chooses a Scenario and a speed and presses Bắt đầu to begin a
 * Conversation in a new private room; Kết thúc leaves it.
 */
export function ConversationPage({
  room,
  agentJoinTimeoutMilliseconds,
  onEnded,
}: ConversationPageProps) {
  const { authorizedFetch } = useAuth();
  // The Member's choice, set when they press Bắt đầu. Each choice has its own
  // source, because a Room Token carries the choice it was requested for.
  const [choice, setChoice] = useState<ConversationChoice | null>(null);
  const roomTokenSource = useMemo(
    () => createRoomTokenSource(authorizedFetch, choice ?? PREPARED_CHOICE),
    [authorizedFetch, choice],
  );
  const session = useSession(roomTokenSource, {
    room,
    agentConnectTimeoutMilliseconds: agentJoinTimeoutMilliseconds,
  });
  const agent = useAgent(session);
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
  // The Agent's failed state clears once the room disconnects, so keep it.
  if (agent.state === 'failed' && failure === null) {
    setFailure('agent-unavailable');
  }
  const inConversation =
    failure === null &&
    session.connectionState !== ConnectionState.Disconnected;

  // A Conversation that failed leaves its room, even when the room finished
  // connecting after the failure.
  const { connectionState, end } = session;
  useEffect(() => {
    if (failure !== null && connectionState !== ConnectionState.Disconnected) {
      void end();
    }
  }, [failure, connectionState, end]);

  // The session only requests Room Tokens from the source of the render it
  // belongs to, so a Conversation starts once that render has the new choice.
  const startSession = useEffectEvent(() => session.start());
  useEffect(() => {
    if (choice !== null) {
      startSession().catch((error: unknown) => {
        setFailure(startFailure(error));
      });
    }
  }, [choice]);

  async function endConversation(): Promise<void> {
    // Read the name while the Room is still joined.
    const roomName = room.name;
    await session.end();
    onEnded(roomName);
  }

  const scenario = SCENARIOS.find(({ id }) => id === choice?.scenarioId);

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
      <SessionProvider session={session}>
        {inConversation && choice !== null && scenario !== undefined ? (
          <>
            <Badge
              label={`${scenario.title} · tốc độ ${SPEED_LABELS[choice.speed].toLowerCase()}`}
              variant="blue"
            />
            <AgentStatus
              personaName={scenario.personaName}
              agentState={agent.state}
              agentVoice={agent.microphoneTrack}
            />
            <Stack direction="horizontal" gap={3}>
              <ListeningHelpButton />
              <Button label="Kết thúc" onClick={() => void endConversation()} />
            </Stack>
          </>
        ) : (
          <ScenarioPicker
            onStart={(chosen) => {
              setFailure(null);
              // A new object each time, so choosing the same again starts again.
              setChoice({ ...chosen });
            }}
          />
        )}
        <RoomAudioRenderer />
      </SessionProvider>
    </Stack>
  );
}
