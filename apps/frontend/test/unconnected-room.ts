import {
  ConnectionState,
  DisconnectReason,
  ParticipantEvent,
  ParticipantKind,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
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
 * connected with, and sending text to the Agent is a spy.
 */
export function createUnconnectedRoom() {
  const room = new Room();
  const connections: RoomConnection[] = [];
  let roomName = '';
  vi.spyOn(room, 'name', 'get').mockImplementation(() => roomName);

  vi.spyOn(room, 'prepareConnection').mockResolvedValue(undefined);
  vi.spyOn(room, 'connect').mockImplementation(
    (serverUrl, participantToken) => {
      connections.push({ serverUrl, participantToken });
      roomName = roomNameOf(participantToken);
      changeConnectionState(room, ConnectionState.Connected);
      room.emit(RoomEvent.Connected);
      return Promise.resolve();
    },
  );
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
  // The stream's details are not the point, so the stub sets only some.
  const sendText = vi.spyOn(localParticipant, 'sendText').mockResolvedValue({
    id: 'text-stream',
    topic: 'lk.chat',
  } as Awaited<ReturnType<typeof localParticipant.sendText>>);
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
    /** The spy on `room.localParticipant.sendText`, which sends nothing. */
    sendText,
    /** Every room this Room connected to, oldest first. */
    connections: (): readonly RoomConnection[] => connections,
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
  };
}
