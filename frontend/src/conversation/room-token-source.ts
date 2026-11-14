import {
  type RoomTokenRequest,
  roomTokenResponseSchema,
} from '@livekit-platform/shared';
import { TokenSource } from 'livekit-client';

/**
 * A new source of Room Tokens. It caches the last Room Token until a
 * Conversation uses it, so each Conversation page creates its own.
 */
export function createRoomTokenSource() {
  return TokenSource.custom(requestRoomToken);
}

/**
 * Gets a Room Token from the backend's standard token endpoint. The backend
 * chooses the room, the participant identity and the Agent dispatch itself,
 * so the request carries no fields.
 */
async function requestRoomToken() {
  const request: RoomTokenRequest = {};
  const response = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(
      `Room Token request failed with status ${String(response.status)}`,
    );
  }
  const roomToken = roomTokenResponseSchema.parse(await response.json());
  return {
    serverUrl: roomToken.server_url,
    participantToken: roomToken.participant_token,
  };
}
