import { useConnectionState, useTrackToggle } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';

/**
 * Whether the Member is in the room with their microphone off, so the tutor
 * cannot hear them. False before the room is joined and after it is left,
 * when there is nothing to hear. Call it inside a LiveKit room context.
 */
export function useMicMuted(): boolean {
  const { enabled } = useTrackToggle({ source: Track.Source.Microphone });
  const connectionState = useConnectionState();
  return !enabled && connectionState === ConnectionState.Connected;
}
