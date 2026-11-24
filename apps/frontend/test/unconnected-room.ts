import {
  ConnectionState,
  DisconnectReason,
  Encryption_Type,
  ParticipantEvent,
  ParticipantKind,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
  type TextStreamHandler,
  type TextStreamInfo,
  type TextStreamReader,
} from 'livekit-client';
import { onTestFinished, vi } from 'vitest';

interface RoomConnection {
  readonly serverUrl: string;
  readonly participantToken: string;
}

function changeConnectionState(room: Room, state: ConnectionState): void {
  room.state = state;
  room.emit(RoomEvent.ConnectionStateChanged, state);
}

/** The name of the room a Room Token is for, read from the token's claims. */
function roomNameOf(participantToken: string): string {
  const claims = JSON.parse(
    Buffer.from(participantToken.split('.')[1] ?? '', 'base64url').toString(),
  ) as { video?: { room?: string } };
  return claims.video?.room ?? '';
}

/** The User's microphone as the Room publishes it, without a media track. */
class LocalMicrophonePublication extends TrackPublication {
  readonly isLocal = true;
}

/** The topic LiveKit's agent framework sends the Conversation's words on. */
const TRANSCRIPTION_TOPIC = 'lk.transcription';

/**
 * One text stream as the Room hands it to a handler: its details and its
 * text in one chunk. livekit-client exports the reader as a type only, so
 * the stub has just what a reader of the stream uses.
 */
function textStream(info: TextStreamInfo, text: string): TextStreamReader {
  let read = false;
  const stream = {
    info,
    [Symbol.asyncIterator]: () => ({
      next: (): Promise<IteratorResult<string>> => {
        const result: IteratorResult<string> = read
          ? { done: true, value: undefined }
          : { done: false, value: text };
        read = true;
        return Promise.resolve(result);
      },
    }),
  };
  return stream as unknown as TextStreamReader;
}

/** Gives the browser a microphone for the current test; jsdom has none. */
function stubBrowserMicrophone(
  getUserMedia: MediaDevices['getUserMedia'],
): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  onTestFinished(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });
}

/**
 * A real livekit-client Room that never connects to a LiveKit server, as in
 * LiveKit's own component tests. Connecting and disconnecting only change its
 * state, the microphone publishes nothing, and the test decides when the
 * Agent joins. Its name is that of the room of the last Room Token it
 * connected with.
 */
export function createUnconnectedRoom() {
  const room = new Room();
  const connections: RoomConnection[] = [];
  let roomName = '';
  vi.spyOn(room, 'name', 'get').mockImplementation(() => roomName);

  // While held, a connection never completes, as when the LiveKit server is
  // slow to answer the join.
  let connectionsHeld = false;
  vi.spyOn(room, 'prepareConnection').mockResolvedValue(undefined);
  const join = (name: string) => {
    roomName = name;
    changeConnectionState(room, ConnectionState.Connected);
    room.emit(RoomEvent.Connected);
  };
  vi.spyOn(room, 'connect').mockImplementation(
    (serverUrl, participantToken) => {
      connections.push({ serverUrl, participantToken });
      if (connectionsHeld) {
        return new Promise<void>(() => undefined);
      }
      join(roomNameOf(participantToken));
      return Promise.resolve();
    },
  );
  // Whoever listens for text streams, by topic, as the Room keeps them.
  const textStreamHandlers = new Map<string, TextStreamHandler>();
  vi.spyOn(room, 'registerTextStreamHandler').mockImplementation(
    (topic, handler) => {
      textStreamHandlers.set(topic, handler);
    },
  );
  vi.spyOn(room, 'unregisterTextStreamHandler').mockImplementation((topic) => {
    textStreamHandlers.delete(topic);
  });
  let transcriptionStreams = 0;
  /**
   * A transcription text stream reaches the Room, as LiveKit's agent
   * framework sends it: a stream per update, grouped by segment.
   */
  const transcribe = (
    identity: string,
    segment: string,
    text: string,
    final: boolean,
  ) => {
    const handler = textStreamHandlers.get(TRANSCRIPTION_TOPIC);
    if (handler === undefined) {
      throw new Error('Nothing listens for transcriptions');
    }
    transcriptionStreams += 1;
    const info: TextStreamInfo = {
      id: `stream-${String(transcriptionStreams)}`,
      mimeType: 'text/plain',
      topic: TRANSCRIPTION_TOPIC,
      timestamp: transcriptionStreams,
      encryptionType: Encryption_Type.NONE,
      attributes: {
        'lk.segment_id': segment,
        'lk.transcription_final': String(final),
      },
    };
    handler(textStream(info, text), { identity });
  };
  const { localParticipant } = room;
  // A fake microphone: it publishes nothing, but the Room reports whether it
  // is on and tells listeners when it is muted or unmuted.
  let microphoneOn = false;
  const microphone = new LocalMicrophonePublication(
    Track.Kind.Audio,
    'TR_microphone',
    'microphone',
  );
  vi.spyOn(localParticipant, 'isMicrophoneEnabled', 'get').mockImplementation(
    () => microphoneOn,
  );
  const switchFakeMicrophone = (enabled: boolean) => {
    microphoneOn = enabled;
    localParticipant.emit(
      enabled ? ParticipantEvent.TrackUnmuted : ParticipantEvent.TrackMuted,
      microphone,
    );
    return Promise.resolve(undefined);
  };
  const askBrowserForMicrophone =
    localParticipant.setMicrophoneEnabled.bind(localParticipant);
  const setMicrophoneEnabled = vi
    .spyOn(localParticipant, 'setMicrophoneEnabled')
    .mockImplementation(switchFakeMicrophone);

  vi.spyOn(room, 'disconnect').mockImplementation(() => {
    if (room.state !== ConnectionState.Disconnected) {
      microphoneOn = false;
      room.remoteParticipants.clear();
      changeConnectionState(room, ConnectionState.Disconnected);
      room.emit(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED);
    }
    return Promise.resolve();
  });

  let agent: RemoteParticipant | undefined;

  return {
    room,
    /** The spy on `room.localParticipant.setMicrophoneEnabled`. */
    setMicrophoneEnabled,
    /** Whether the fake microphone is on. */
    microphoneIsOn: (): boolean => microphoneOn,
    /** The Room joins the room `name` at once, without a Room Token. */
    joins(name = 'conversation-1'): void {
      join(name);
    },
    /** Every room this Room connected to, oldest first. */
    connections: (): readonly RoomConnection[] => connections,
    /** From now on, joining a room never completes. */
    holdConnections(): void {
      connectionsHeld = true;
    },
    /**
     * The Conversation ends without the User: the Agent left and the server
     * deleted the room, so the Room disconnects.
     */
    serverDeletesRoom(): void {
      microphoneOn = false;
      room.remoteParticipants.clear();
      changeConnectionState(room, ConnectionState.Disconnected);
      room.emit(RoomEvent.Disconnected, DisconnectReason.ROOM_DELETED);
    },
    /**
     * The User blocks the browser's microphone prompt. The Room asks the
     * browser for the microphone as it does for real, and the browser refuses
     * once the room has connected, when a person would answer the prompt.
     */
    denyMicrophoneAccess(): void {
      setMicrophoneEnabled.mockImplementation(askBrowserForMicrophone);
      stubBrowserMicrophone(
        () =>
          new Promise((_resolve, reject) => {
            room.once(RoomEvent.Connected, () => {
              reject(new DOMException('Permission denied', 'NotAllowedError'));
            });
          }),
      );
    },
    /** The User allows the microphone again: the fake microphone. */
    allowMicrophoneAccess(): void {
      setMicrophoneEnabled.mockImplementation(switchFakeMicrophone);
    },
    /** The Agent joins the room and reports that it is listening. */
    agentJoins(): void {
      agent = new RemoteParticipant(
        room.engine.client,
        'PA_agent',
        'agent',
        'Agent',
        '',
        { 'lk.agent.state': 'listening' },
        undefined,
        ParticipantKind.AGENT,
      );
      room.remoteParticipants.set(agent.identity, agent);
      room.emit(RoomEvent.ParticipantConnected, agent);
    },
    /**
     * The Agent reports a new state through its `lk.agent.state` attribute,
     * as LiveKit's agent framework does.
     */
    agentIs(state: 'listening' | 'thinking' | 'speaking'): void {
      if (!agent) {
        throw new Error('The Agent has not joined the room');
      }
      const attributes = { 'lk.agent.state': state };
      vi.spyOn(agent, 'attributes', 'get').mockReturnValue(attributes);
      // A connected Room forwards its participants' events; this one isn't.
      agent.emit(ParticipantEvent.AttributesChanged, attributes);
      room.emit(RoomEvent.ParticipantAttributesChanged, attributes, agent);
    },
    /**
     * The Agent sends what it says in `segment` so far, as its transcription.
     * Its stream of a segment says not final, as the agent framework's does.
     */
    agentSays(segment: string, text: string): void {
      transcribe(agent?.identity ?? 'agent', segment, text, false);
    },
    /**
     * The Agent sends what it heard the Member say in `segment`, on the
     * Member's behalf; `final` is false while the Member is still talking.
     */
    memberSays(segment: string, text: string, { final = true } = {}): void {
      transcribe(localParticipant.identity, segment, text, final);
    },
  };
}
