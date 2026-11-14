// Compile-time contract between the Room Token endpoint and livekit-client.
// `pnpm typecheck` fails when the shared schemas drift from LiveKit's
// standard token endpoint shape.
import type {
  TokenSourceRequestPayload,
  TokenSourceResponsePayload,
} from 'livekit-client';
import type { z } from 'zod';
import type {
  roomTokenRequestSchema,
  RoomTokenResponse,
} from './room-token.ts';

type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type Expect<T extends true> = T;

type RoomTokenRequestBody = z.input<typeof roomTokenRequestSchema>;

export type RoomTokenContract = [
  // The request has exactly LiveKit's standard fields...
  Expect<
    MutuallyAssignable<
      keyof RoomTokenRequestBody,
      keyof TokenSourceRequestPayload
    >
  >,
  // ...and accepts any request livekit-client can send, since every field is optional on the wire.
  Expect<
    Partial<TokenSourceRequestPayload> extends RoomTokenRequestBody
      ? true
      : false
  >,
  // The response is exactly what livekit-client reads back.
  Expect<
    MutuallyAssignable<
      keyof RoomTokenResponse,
      keyof TokenSourceResponsePayload
    >
  >,
  Expect<MutuallyAssignable<RoomTokenResponse, TokenSourceResponsePayload>>,
];
