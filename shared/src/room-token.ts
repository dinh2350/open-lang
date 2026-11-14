import { z } from 'zod';

/**
 * Body of a Room Token request, in LiveKit's standard token endpoint shape.
 * The backend accepts these fields but ignores them: it chooses the room,
 * the participant identity and the Agent dispatch itself.
 */
export const roomTokenRequestSchema = z.object({
  room_name: z.string().optional(),
  participant_identity: z.string().optional(),
  participant_name: z.string().optional(),
  participant_metadata: z.string().optional(),
  participant_attributes: z.record(z.string(), z.string()).optional(),
  room_config: z.record(z.string(), z.unknown()).optional(),
});

export type RoomTokenRequest = z.infer<typeof roomTokenRequestSchema>;

/** Body of a `201` Room Token response, in LiveKit's standard token endpoint shape. */
export const roomTokenResponseSchema = z.object({
  server_url: z.string().min(1),
  participant_token: z.string().min(1),
});

export type RoomTokenResponse = z.infer<typeof roomTokenResponseSchema>;
