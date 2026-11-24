import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { HStack } from '@astryxdesign/core/HStack';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
} from '@livekit/components-react';
import {
  ConnectionState,
  MediaDeviceFailure,
  type Room,
  RoomEvent,
} from 'livekit-client';
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/auth/auth-context';
import { NotebookIcon } from '@/icons';
import { AgentStatus } from './agent-status';
import { MicToggle } from './mic-toggle';
import { NotesEmpty, NotesPanel, useNoteCount } from './notes-panel';
import { createRoomTokenSource } from './room-token-source';
import { TranscriptPanel } from './transcript-panel';

/** From this width on, the transcript and the notes sit side by side. */
const SIDE_BY_SIDE_QUERY = '(min-width: 640px)';

/** Why a Conversation could not go on. */
export type ConversationFailure =
  'microphone-denied' | 'start-failed' | 'agent-unavailable';

interface ConversationSessionProps {
  /** The LiveKit Room the Conversation connects through. */
  readonly room: Room;
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
 * per Conversation, keyed by it. The screen shows the voice bars, how the
 * tutor is doing, the mic button, "Kết thúc", and what is said and the Notes
 * the tutor writes.
 */
export function ConversationSession({
  room,
  agentJoinTimeoutMilliseconds,
  onFailed,
  onEnded,
}: ConversationSessionProps) {
  const { authorizedFetch } = useAuth();
  const [roomTokenSource] = useState(() =>
    createRoomTokenSource(authorizedFetch),
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
  const [roomName, setRoomName] = useState<string | null>(null);
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
      setRoomName(room.name);
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

  if (failure !== null) {
    return null;
  }
  return (
    <SessionProvider session={session}>
      <AgentStatus
        agentState={agent.state}
        agentVoice={agent.microphoneTrack}
      />
      <HStack gap={3} align="start" justify="center">
        <MicToggle />
        <Button label="Kết thúc" onClick={() => void finish()} />
      </HStack>
      <ConversationPanels roomName={roomName} />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}

/** The Notes of the room once it is joined; before, there are none. */
function Notes({ roomName }: { readonly roomName: string | null }) {
  return roomName === null ? (
    <NotesEmpty />
  ) : (
    <NotesPanel roomName={roomName} />
  );
}

type PanelTab = 'transcript' | 'notes';

/**
 * What is said and the Notes: side by side on a wide screen, and on a phone
 * in two tabs, the Ghi chú tab saying how many Notes there are. Both layouts
 * render the same tree, with the tabs in a slot of their own, so turning a
 * phone or switching tabs never remounts the transcript, which would lose
 * the lines said so far. On a phone the tab not chosen is only hidden.
 */
function ConversationPanels({
  roomName,
}: {
  readonly roomName: string | null;
}) {
  const sideBySide = useMediaQuery(SIDE_BY_SIDE_QUERY, true);
  const [tab, setTab] = useState<PanelTab>('transcript');
  const noteCount = useNoteCount(roomName);
  const transcriptId = useId();
  const notesId = useId();
  return (
    <Grid
      columns={sideBySide ? 2 : 1}
      gap={sideBySide ? 6 : 4}
      width="100%"
      maxWidth="64rem"
      align="start"
    >
      {!sideBySide && (
        <TabList
          role="tablist"
          layout="fill"
          hasDivider
          value={tab}
          onChange={(value) => {
            setTab(value === 'notes' ? 'notes' : 'transcript');
          }}
        >
          <Tab value="transcript" label="Cuộc nói" panelId={transcriptId} />
          <Tab
            value="notes"
            label="Ghi chú"
            panelId={notesId}
            icon={<Icon icon={NotebookIcon} />}
            endContent={
              noteCount > 0 && (
                <Badge variant="neutral" label={String(noteCount)} />
              )
            }
          />
        </TabList>
      )}
      <Panel
        id={transcriptId}
        title="Cuộc nói"
        isTab={!sideBySide}
        isHidden={!sideBySide && tab !== 'transcript'}
      >
        <TranscriptPanel />
      </Panel>
      <Panel
        id={notesId}
        title="Ghi chú"
        icon={<Icon icon={NotebookIcon} />}
        isTab={!sideBySide}
        isHidden={!sideBySide && tab !== 'notes'}
      >
        <Notes roomName={roomName} />
      </Panel>
    </Grid>
  );
}

/**
 * One panel: a card with a heading side by side, or a tab panel named by
 * its title on a phone, where the tab shows the title.
 */
function Panel({
  id,
  title,
  icon,
  isTab,
  isHidden,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly icon?: ReactNode;
  readonly isTab: boolean;
  readonly isHidden: boolean;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <div
      id={id}
      role={isTab ? 'tabpanel' : undefined}
      aria-label={isTab ? title : undefined}
      hidden={isHidden}
    >
      <Card
        variant={isTab ? 'transparent' : 'default'}
        padding={isTab ? 0 : undefined}
      >
        <Stack
          as="section"
          aria-labelledby={isTab ? undefined : headingId}
          gap={4}
        >
          {!isTab && (
            <Heading level={2} id={headingId}>
              <HStack as="span" gap={2} align="center">
                {icon}
                <span>{title}</span>
              </HStack>
            </Heading>
          )}
          {children}
        </Stack>
      </Card>
    </div>
  );
}
