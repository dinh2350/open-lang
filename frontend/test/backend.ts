import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';

export const TEST_LIVEKIT_URL = 'ws://livekit.test:7880';
const TEST_AGENT_NAME = 'test-agent';
const TEN_MINUTES_IN_SECONDS = 600;

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * A Room Token with the claims the backend issues: a new room, a new
 * participant identity and a dispatch of the Agent. livekit-client only
 * decodes it; the unconnected Room never checks its signature.
 */
function roomToken(roomName: string): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const claims = {
    sub: `participant-in-${roomName}`,
    iat: nowInSeconds,
    exp: nowInSeconds + TEN_MINUTES_IN_SECONDS,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    },
    roomConfig: { agents: [{ agentName: TEST_AGENT_NAME }] },
  };
  return `${base64UrlJson({ alg: 'HS256', typ: 'JWT' })}.${base64UrlJson(claims)}.unsigned`;
}

const issuedRoomTokens: string[] = [];

/** The Room Tokens the backend issued in the current test, oldest first. */
export function roomTokensIssued(): readonly string[] {
  return issuedRoomTokens;
}

/** The backend's `/api` endpoints, as the browser sees them. */
export const backend = setupServer(
  http.post('/api/token', () => {
    const participantToken = roomToken(
      `conversation-${String(issuedRoomTokens.length + 1)}`,
    );
    issuedRoomTokens.push(participantToken);
    return HttpResponse.json(
      { server_url: TEST_LIVEKIT_URL, participant_token: participantToken },
      { status: 201 },
    );
  }),
);

export function resetBackend(): void {
  backend.resetHandlers();
  issuedRoomTokens.length = 0;
}

let requestsInFlight = 0;
backend.events.on('request:start', () => {
  requestsInFlight += 1;
});
backend.events.on('request:end', () => {
  requestsInFlight -= 1;
});

/**
 * Waits until the backend has answered every request sent so far. When a
 * Conversation ends or the page unmounts, useSession fetches the next Room
 * Token in the background; waiting keeps that request from meeting the next
 * test's handlers.
 */
export async function allRequestsAnswered(): Promise<void> {
  // A request sent a moment ago reaches the backend after pending microtasks.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await vi.waitFor(() => {
    if (requestsInFlight > 0) {
      throw new Error(
        `${String(requestsInFlight)} requests are waiting for the backend`,
      );
    }
  });
}
