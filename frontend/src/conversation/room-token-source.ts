import {
  type RoomTokenRequest,
  roomTokenResponseSchema,
} from '@livekit-platform/shared';
import { TokenSource } from 'livekit-client';

/**
 * Gets a Room Token from the backend's standard token endpoint. The backend
 * chooses the room, the participant identity and the Agent dispatch itself,
 * so the request carries no fields.
 */
export const roomTokenSource = TokenSource.custom(async () => {
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
});
