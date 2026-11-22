import {
  type RoomTokenRequest,
  roomTokenResponseSchema,
} from '@open-lang/shared';
import { TokenSource } from 'livekit-client';
import type { AuthorizedFetch } from '@/auth/auth-context';

/**
 * A new source of Room Tokens for the signed-in User. It caches the last
 * Room Token until a Conversation uses it, so each Conversation page creates
 * its own.
 */
export function createRoomTokenSource(authorizedFetch: AuthorizedFetch) {
  return TokenSource.custom(() => requestRoomToken(authorizedFetch));
}

/**
 * Gets a Room Token from the backend's standard token endpoint, with the
 * User's Auth Token. The backend chooses the room, the participant identity
 * and the Agent dispatch itself, so the request carries no fields.
 */
async function requestRoomToken(authorizedFetch: AuthorizedFetch) {
  const request: RoomTokenRequest = {};
  const response = await authorizedFetch('/api/token', {
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
