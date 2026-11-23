import { Badge } from '@astryxdesign/core/Badge';
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
  SCENARIOS,
  SPEED_LABELS,
} from '@open-lang/shared';
import {
  ConnectionState,
  MediaDeviceFailure,
  type Room,
  RoomEvent,
} from 'livekit-client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { AgentStatus } from './agent-status';
import { ListeningHelpButton } from './listening-help-button';
import { createRoomTokenSource } from './room-token-source';

/** Why a Conversation could not go on. */
export type ConversationFailure =
  'microphone-denied' | 'start-failed' | 'agent-unavailable';

interface ConversationSessionProps {
  /** The LiveKit Room the Conversation connects through. */
  readonly room: Room;
  /** What the Member chose: the Scenario the Agent plays, and its speed. */
  readonly choice: ConversationChoice;
  /**
   * How long the Conversation waits for the Agent to join and start
   * listening before it fails with `agent-unavailable`.
   */
  readonly agentJoinTimeoutMilliseconds: number;
  /** Called once when the Conversation fails; it then leaves its room. */
  readonly onFailed: (failure: ConversationFailure) => void;
  /**
   * Called once when the Conversation ends: by Kết thúc, or because the Room
   * disconnected after it joined. It gets the name of the room this
   * Conversation joined, or null when it never joined one.
   */
  readonly onEnded: (roomName: string | null) => void;
}

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
 * One Conversation, from the moment the Member pressed Bắt đầu: it mounts
 * then, so the session's own Room Token request, which `useSession` makes on
 * mount, is the Conversation's Room Token, and it starts at once. Mount one
 * per Conversation, keyed by it. The quiet screen shows only the Scenario and
 * speed, how the persona is doing, the voice bars, "Chưa nghe kịp" and
 * "Kết thúc".
 */
export function ConversationSession({
  room,
  choice,
  agentJoinTimeoutMilliseconds,
  onFailed,
  onEnded,
}: ConversationSessionProps) {
  const { authorizedFetch } = useAuth();
  const [roomTokenSource] = useState(() =>
    createRoomTokenSource(authorizedFetch, choice),
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

  // Strict mode runs a mount effect twice; a session starts only once.
  const started = useRef(false);
  const startSession = useEffectEvent(() => session.start());
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    startSession().catch((error: unknown) => {
      setFailure(startFailure(error));
    });
  }, []);

  const reportFailure = useEffectEvent(onFailed);
  useEffect(() => {
    if (failure !== null) {
      reportFailure(failure);
    }
  }, [failure]);

  // A Conversation that failed leaves its room, even when the room finished
  // connecting after the failure.
  const { connectionState, end } = session;
  useEffect(() => {
    if (failure !== null && connectionState !== ConnectionState.Disconnected) {
      void end();
    }
  }, [failure, connectionState, end]);

  // The room this Conversation joined, from the moment it joined. The Room
  // lives as long as the tab and keeps the name of the last room it joined,
  // so its name means this Conversation's room only after this Connected.
  const joinedRoom = useRef<string | null>(null);
  // Set when the Conversation ends, so it ends once.
  const ended = useRef(false);
  async function finish(): Promise<void> {
    if (ended.current) {
      return;
    }
    ended.current = true;
    const roomName = joinedRoom.current;
    await end();
    onEnded(roomName);
  }
  // The Room disconnecting after it joined, without Kết thúc or a failure,
  // ends the Conversation too: the Agent ended it, or the room was deleted.
  const disconnected = useEffectEvent(() => {
    if (joinedRoom.current !== null && failure === null) {
      void finish();
    }
  });
  useEffect(() => {
    const onConnected = () => {
      joinedRoom.current = room.name;
    };
    const onDisconnected = () => {
      disconnected();
    };
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  const scenario = SCENARIOS.find(({ id }) => id === choice.scenarioId);
  if (failure !== null || scenario === undefined) {
    return null;
  }
  return (
    <SessionProvider session={session}>
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
        <Button label="Kết thúc" onClick={() => void finish()} />
      </Stack>
      <RoomAudioRenderer />
    </SessionProvider>
  );
}
