import {
  type Environment,
  parseEnv,
  registerRequestSchema,
} from '@open-live-agent/shared';
import argon2 from 'argon2';
import { z } from 'zod';
import type { UsersService } from './users.service.js';

// The same rules as registering: a valid email, stored lowercase, and a
// password of at least 12 characters.
const seedEnvSchema = z.object({
  SEED_ADMIN_EMAIL: registerRequestSchema.shape.email,
  SEED_ADMIN_PASSWORD: registerRequestSchema.shape.password,
});

export type FirstAdminSeed =
  | { readonly outcome: 'created'; readonly userId: string }
  | { readonly outcome: 'admin-exists' };

/**
 * Creates the first Admin from SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, so
 * a fresh database has someone who can manage Users. It does nothing when an
 * Admin exists, and then needs neither variable.
 */
export async function seedFirstAdmin(
  users: UsersService,
  env: Environment,
): Promise<FirstAdminSeed> {
  if ((await users.findAnAdmin()) !== null) {
    return { outcome: 'admin-exists' };
  }
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = parseEnv(
    seedEnvSchema,
    env,
    'Invalid seed settings in the backend environment',
  );
  // Promoting an existing account would hand Admin rights to whoever
  // registered this email first, with their own password.
  if ((await users.findByEmail(email)) !== null) {
    throw new Error(
      'SEED_ADMIN_EMAIL already belongs to a Member. Set SEED_ADMIN_EMAIL to an email nobody has registered, then run the seed again.',
    );
  }
  const admin = await users.create({
    email,
    passwordHash: await argon2.hash(password),
    role: 'admin',
  });
  return { outcome: 'created', userId: admin.id };
}
