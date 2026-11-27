import { liveKitEnvSchema } from '@open-lang/shared';
import { z } from 'zod';

const databaseUrl = z.url({ protocol: /^postgres(ql)?$/ });

/** An optional variable whose blank value counts as unset. */
function unsetIfEmpty<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );
}

/**
 * Every environment variable the backend needs. `@nestjs/config` checks it
 * when the application starts, so a missing or invalid variable stops the
 * backend before it serves anything.
 */
export const backendEnvSchema = liveKitEnvSchema
  .extend({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: databaseUrl,
    // HS256 needs a key of at least 256 bits.
    JWT_SECRET: z.string().min(32),
    // The key the Agent sends with each report. Like JWT_SECRET, at least 32
    // characters, so it can't be guessed.
    AGENT_API_KEY: z.string().min(32),
    // Which model writes the Reports. `fake` gives canned answers.
    REPORT_PROVIDER: z.enum(['fake', 'openai', 'google']).default('fake'),
    // The Provider's model; each Provider has a default (see
    // `DEFAULT_REPORT_MODEL`).
    REPORT_MODEL: unsetIfEmpty(z.string()),
    // Which model judges what the User recalled of the learner profile's
    // items. `fake` judges nothing.
    LEARNER_PROVIDER: z.enum(['fake', 'openai', 'google']).default('fake'),
    // The Provider's model; each Provider has a default (see
    // `DEFAULT_LEARNER_MODEL`).
    LEARNER_MODEL: unsetIfEmpty(z.string()),
    // Each key is read only when its Provider is chosen. A blank value, as in
    // .env.example, counts as unset.
    OPENAI_API_KEY: unsetIfEmpty(z.string()),
    GOOGLE_API_KEY: unsetIfEmpty(z.string()),
  })
  .check((ctx) => {
    const keys = {
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
    } as const;

    for (const setting of ['REPORT_PROVIDER', 'LEARNER_PROVIDER'] as const) {
      const provider = ctx.value[setting];
      if (provider === 'fake') continue;

      const name = keys[provider];
      if (ctx.value[name] === undefined) {
        ctx.issues.push({
          code: 'custom',
          message: `${name} is required when ${setting} is "${provider}"`,
          path: [name],
          input: ctx.value[name],
        });
      }
    }
  });

export type BackendEnv = z.output<typeof backendEnvSchema>;

/** The part of the environment that PrismaService reads. */
export type DatabaseEnv = Pick<BackendEnv, 'DATABASE_URL'>;

/**
 * What `pnpm db:seed` needs at startup: the database. The SEED_ADMIN_
 * variables are checked only when no Admin exists yet (see `first-admin.ts`),
 * so a database that has an Admin needs neither.
 */
export const seedEnvSchema = z.object({
  DATABASE_URL: databaseUrl,
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

export type SeedEnv = z.output<typeof seedEnvSchema>;
