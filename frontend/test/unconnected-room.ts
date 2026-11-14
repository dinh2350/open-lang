import {
  ConnectionState,
  DisconnectReason,
  ParticipantEvent,
  ParticipantKind,
  RemoteParticipant,
  Room,
  RoomEvent,
} from 'livekit-client';
import { vi } from 'vitest';

interface RoomConnection {
  readonly serverUrl: string;
  readonly participantToken: string;
}

function changeConnectionState(room: Room, state: ConnectionState): void {
  room.state = state;
  room.emit(RoomEvent.ConnectionStateChanged, state);
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
  vi.spyOn(room.localParticipant, 'setMicrophoneEnabled').mockResolvedValue(
    undefined,
  );

  let agent: RemoteParticipant | undefined;

  return {
    room,
    /** Every room this Room connected to, oldest first. */
    connections: (): readonly RoomConnection[] => connections,
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
