import {
  ConnectionState,
  DisconnectReason,
  ParticipantKind,
  RemoteParticipant,
  Room,
  RoomEvent,
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
 * Agent joins.
 */
export function createUnconnectedRoom() {
  const room = new Room();
  const connections: RoomConnection[] = [];

  vi.spyOn(room, 'prepareConnection').mockResolvedValue(undefined);
  vi.spyOn(room, 'connect').mockImplementation(
    (serverUrl, participantToken) => {
      connections.push({ serverUrl, participantToken });
      changeConnectionState(room, ConnectionState.Connected);
      room.emit(RoomEvent.Connected);
      return Promise.resolve();
    },
  );
  vi.spyOn(room, 'disconnect').mockImplementation(() => {
    if (room.state !== ConnectionState.Disconnected) {
      room.remoteParticipants.clear();
      changeConnectionState(room, ConnectionState.Disconnected);
      room.emit(RoomEvent.Disconnected, DisconnectReason.CLIENT_INITIATED);
    }
    return Promise.resolve();
  });
  const setMicrophoneEnabled = vi
    .spyOn(room.localParticipant, 'setMicrophoneEnabled')
    .mockResolvedValue(undefined);

  return {
    room,
    /** Every room this Room connected to, oldest first. */
    connections: (): readonly RoomConnection[] => connections,
    /**
     * The User blocks the browser's microphone prompt. The Room asks the
     * browser for the microphone as it does for real, and the browser refuses
     * once the room has connected, when a person would answer the prompt.
     */
    denyMicrophoneAccess(): void {
      setMicrophoneEnabled.mockRestore();
      stubBrowserMicrophone(
        () =>
          new Promise((_resolve, reject) => {
            room.once(RoomEvent.Connected, () => {
              reject(new DOMException('Permission denied', 'NotAllowedError'));
            });
          }),
      );
    },
    /** The Agent joins the room and reports that it is listening. */
    agentJoins(): void {
      const agent = new RemoteParticipant(
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
  };
}
