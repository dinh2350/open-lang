import {
  type ConversationChoice,
  type RoomTokenRequest,
  roomTokenResponseSchema,
} from '@open-lang/shared';
import { TokenSource } from 'livekit-client';
import type { AuthorizedFetch } from '@/auth/auth-context';

/**
 * A new source of Room Tokens for the signed-in User, who chose `choice` of
 * Scenario and speed. It caches the last Room Token until a Conversation uses
 * it, and that Room Token carries the choice, so each choice needs its own
 * source.
 */
export function createRoomTokenSource(
  authorizedFetch: AuthorizedFetch,
  choice: ConversationChoice,
) {
  return TokenSource.custom(() => requestRoomToken(authorizedFetch, choice));
}

/**
 * Gets a Room Token from the backend's standard token endpoint, with the
 * User's Auth Token. The backend chooses the room, the participant identity
 * and the Agent dispatch itself; the request carries only the User's choice,
 * as the JSON of the standard `participant_metadata` field.
 */
async function requestRoomToken(
  authorizedFetch: AuthorizedFetch,
  choice: ConversationChoice,
) {
  const request: RoomTokenRequest = {
    participant_metadata: JSON.stringify(choice),
  };
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
