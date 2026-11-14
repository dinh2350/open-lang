import assert from 'node:assert/strict';
import type { IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { llm } from '@livekit/agents';
import { WebSocketServer } from 'ws';

/** What a realtime model sent when it connected. */
export interface RealtimeConnection {
  /** The path and query string it connected to. */
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  /** Its first message, parsed from JSON. */
  readonly firstMessage: unknown;
}

/**
 * Stands in for a Provider's realtime WebSocket API, such as OpenAI's
 * Realtime API or the Gemini Live API: it accepts a connection and records
 * what the realtime model sends first. It never answers.
 */
export interface FakeRealtimeApi {
  /** The URL to give the plugin instead of the Provider's, over plain HTTP. */
  readonly baseUrl: string;
  /** Opens a session on the realtime model, and returns what it sent. */
  connect(realtimeModel: unknown): Promise<RealtimeConnection>;
  close(): Promise<void>;
}

export async function startFakeRealtimeApi(): Promise<FakeRealtimeApi> {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    async connect(realtimeModel) {
      if (!(realtimeModel instanceof llm.RealtimeModel)) {
        throw new TypeError('Realtime mode has a realtime model');
      }
      const connected = new Promise<RealtimeConnection>((resolve) => {
        server.once('connection', (socket, request) => {
          socket.once('message', (data) => {
            assert(Buffer.isBuffer(data), 'Realtime models send JSON text');
            resolve({
              url: request.url ?? '',
              headers: request.headers,
              firstMessage: JSON.parse(data.toString('utf8')),
            });
          });
        });
      });
      const session = realtimeModel.session();
      try {
        return await connected;
      } finally {
        await session.close();
      }
    },
    async close() {
      for (const client of server.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
