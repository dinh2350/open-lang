import { z } from 'zod';
import { roleSchema, userSchema } from './auth.ts';

/** A User as an Admin sees them on the admin Users page. */
export const userDetailsSchema = userSchema.extend({
  /** A Locked User can't sign in or call the backend. */
  locked: z.boolean(),
  /** When the User registered, as an ISO 8601 timestamp. */
  createdAt: z.iso.datetime(),
});

export type UserDetails = z.infer<typeof userDetailsSchema>;

/** Body of the response that lists every User, oldest first. */
export const usersResponseSchema = z.object({
  users: z.array(userDetailsSchema),
});

export type UsersResponse = z.infer<typeof usersResponseSchema>;

/** Body of a request that changes a User's Role. */
export const changeRoleRequestSchema = z.object({
  role: roleSchema,
});

export type ChangeRoleRequest = z.infer<typeof changeRoleRequestSchema>;

/** Body of a request that locks or unlocks a User. */
export const changeLockedRequestSchema = z.object({
  locked: z.boolean(),
});

export type ChangeLockedRequest = z.infer<typeof changeLockedRequestSchema>;
