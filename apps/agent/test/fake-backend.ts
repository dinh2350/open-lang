import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

/** An AGENT_API_KEY for tests, of the 32 characters the Agent requires. */
export const TEST_AGENT_API_KEY = 'agent-api-key-of-at-least-32-characters';

export interface ReceivedRequest {
  method: string | undefined;
  url: string | undefined;
  authorization: string | undefined;
  contentType: string | undefined;
  body: unknown;
}

export interface FakeBackend {
  /** The backend's base URL, for BACKEND_URL. */
  url: string;
  /** Every request received so far, oldest first. */
  requests: ReceivedRequest[];
  /**
   * What happened, in order: `received <url>` once a request's body is in,
   * `answered <url>` once its response is sent.
   */
  events: string[];
  close(): Promise<void>;
}

/**
 * A backend on a free local port, so no test reaches a real one. It answers
 * each request with the next of `statuses`, then with 204, after
 * `responseDelayMs` (default 0).
 */
export async function startFakeBackend(
  statuses: number[] = [],
  options: { responseDelayMs?: number } = {},
): Promise<FakeBackend> {
  const requests: ReceivedRequest[] = [];
  const events: string[] = [];
  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        requests.push({
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          contentType: request.headers['content-type'],
          body: body === '' ? undefined : JSON.parse(body),
        });
        events.push(`received ${request.url ?? ''}`);
        response.statusCode = statuses.shift() ?? 204;
        setTimeout(() => {
          events.push(`answered ${request.url ?? ''}`);
          response.end();
        }, options.responseDelayMs ?? 0);
      });
    },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    events,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
