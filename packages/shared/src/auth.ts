import { z } from 'zod';

export const MINIMUM_PASSWORD_LENGTH = 12;

/** Emails are compared lowercase, so an email is unique whatever its case. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

/** What a User may do. Every new User is a Member. */
export const roleSchema = z.enum(['member', 'admin']);

export type Role = z.infer<typeof roleSchema>;

/** A User, as the backend returns it. */
export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: roleSchema,
});

export type User = z.infer<typeof userSchema>;

/** Body of a register request: at least 12 characters, no composition rules. */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(MINIMUM_PASSWORD_LENGTH, {
    error: `Use at least ${String(MINIMUM_PASSWORD_LENGTH)} characters for your password.`,
  }),
});

export type RegisterRequest = z.input<typeof registerRequestSchema>;

/** Body of a sign-in request. */
export const signInRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export type SignInRequest = z.input<typeof signInRequestSchema>;

/** Body of a successful register or sign-in response. */
export const authResponseSchema = z.object({
  /** Proves which User is calling the backend; send it as a Bearer token. */
  authToken: z.string().min(1),
  user: userSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Body of a 4xx response: NestJS's standard error shape. */
export const errorResponseSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
});

/**
 * The `errorCode` of the `403` a Locked User gets, on sign-in and on every
 * request that needs a signed-in User. Other `403`s, such as a Member calling
 * the Admin API, don't have it.
 */
export const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';

/** Body of the `403` a Locked User gets. */
export const accountLockedResponseSchema = z.object({
  errorCode: z.literal(ACCOUNT_LOCKED),
  message: z.string(),
});
