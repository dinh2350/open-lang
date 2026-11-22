import { describe, expect, it } from 'vitest';
import { backendEnvSchema, seedEnvSchema } from '../src/config/env.schema.js';
import { testEnv } from './support/test-app.js';

type Env = Record<string, string | undefined>;

/** The names of the variables the schema rejects, or none when it accepts. */
function rejectedVariables(
  schema: typeof backendEnvSchema,
  env: Env,
): string[] {
  const result = schema.safeParse(env);
  return result.success
    ? []
    : result.error.issues.map((issue) => String(issue.path[0]));
}

const without = (name: string): Env =>
  Object.fromEntries(Object.entries(testEnv).filter(([key]) => key !== name));

describe('The backend environment schema', () => {
  it('accepts a complete environment and defaults PORT to 3000', () => {
    expect(backendEnvSchema.parse(testEnv).PORT).toBe(3000);
  });

  it('reads PORT as a number', () => {
    expect(backendEnvSchema.parse({ ...testEnv, PORT: '8080' }).PORT).toBe(
      8080,
    );
  });

  it('ignores variables it does not declare', () => {
    expect(
      rejectedVariables(backendEnvSchema, { ...testEnv, PATH: '/bin' }),
    ).toEqual([]);
  });

  it.each(Object.keys(testEnv))(
    'rejects an environment without %s, naming it',
    (name) => {
      expect(rejectedVariables(backendEnvSchema, without(name))).toEqual([
        name,
      ]);
    },
  );

  it('requires AGENT_API_KEY of at least 32 characters', () => {
    const rejectedFor = (key: string) =>
      rejectedVariables(backendEnvSchema, { ...testEnv, AGENT_API_KEY: key });

    expect(rejectedFor('x'.repeat(31))).toEqual(['AGENT_API_KEY']);
    expect(rejectedFor('')).toEqual(['AGENT_API_KEY']);
    expect(rejectedFor('x'.repeat(32))).toEqual([]);
  });

  it('defaults REPORT_PROVIDER to fake and rejects an unknown provider', () => {
    expect(backendEnvSchema.parse(testEnv).REPORT_PROVIDER).toBe('fake');
    expect(
      rejectedVariables(backendEnvSchema, {
        ...testEnv,
        REPORT_PROVIDER: 'nope',
      }),
    ).toEqual(['REPORT_PROVIDER']);
  });

  describe('REPORT_PROVIDER keys', () => {
    const rejectedFor = (env: Env) =>
      rejectedVariables(backendEnvSchema, { ...testEnv, ...env });

    it('requires OPENAI_API_KEY when REPORT_PROVIDER is openai', () => {
      expect(rejectedFor({ REPORT_PROVIDER: 'openai' })).toEqual([
        'OPENAI_API_KEY',
      ]);
      expect(
        rejectedFor({ REPORT_PROVIDER: 'openai', OPENAI_API_KEY: '' }),
      ).toEqual(['OPENAI_API_KEY']);
      expect(
        rejectedFor({ REPORT_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' }),
      ).toEqual([]);
    });

    it('requires GOOGLE_API_KEY when REPORT_PROVIDER is google', () => {
      expect(rejectedFor({ REPORT_PROVIDER: 'google' })).toEqual([
        'GOOGLE_API_KEY',
      ]);
      expect(
        rejectedFor({ REPORT_PROVIDER: 'google', GOOGLE_API_KEY: '' }),
      ).toEqual(['GOOGLE_API_KEY']);
      expect(
        rejectedFor({ REPORT_PROVIDER: 'google', GOOGLE_API_KEY: 'g-test' }),
      ).toEqual([]);
    });

    it('needs no key for fake', () => {
      expect(rejectedFor({ REPORT_PROVIDER: 'fake' })).toEqual([]);
      expect(
        rejectedFor({ REPORT_PROVIDER: 'fake', OPENAI_API_KEY: '' }),
      ).toEqual([]);
    });

    it('names the variable and the provider in the message', () => {
      const result = backendEnvSchema.safeParse({
        ...testEnv,
        REPORT_PROVIDER: 'openai',
      });

      expect(result.success ? '' : result.error.issues[0]?.message).toBe(
        'OPENAI_API_KEY is required when REPORT_PROVIDER is "openai"',
      );
    });

    it('treats a blank REPORT_MODEL as unset', () => {
      expect(
        backendEnvSchema.parse({ ...testEnv, REPORT_MODEL: '' }).REPORT_MODEL,
      ).toBeUndefined();
      expect(
        backendEnvSchema.parse({ ...testEnv, REPORT_MODEL: 'm' }).REPORT_MODEL,
      ).toBe('m');
    });
  });

  it.each([
    [
      'a blank JWT_SECRET, as in .env.example',
      { JWT_SECRET: '' },
      'JWT_SECRET',
    ],
    [
      'a JWT_SECRET of 31 characters',
      { JWT_SECRET: 'x'.repeat(31) },
      'JWT_SECRET',
    ],
    ['a PORT that is not a number', { PORT: 'abc' }, 'PORT'],
    ['a PORT of zero', { PORT: '0' }, 'PORT'],
    [
      'a LIVEKIT_URL that is not a WebSocket URL',
      { LIVEKIT_URL: 'https://livekit.test' },
      'LIVEKIT_URL',
    ],
    [
      'a DATABASE_URL that is not a Postgres URL',
      { DATABASE_URL: 'mysql://localhost/open_lang' },
      'DATABASE_URL',
    ],
  ])('rejects %s, naming it', (_case, override, name) => {
    expect(
      rejectedVariables(backendEnvSchema, { ...testEnv, ...override }),
    ).toEqual([name]);
  });
});

describe('The seed environment schema', () => {
  it('accepts DATABASE_URL alone', () => {
    expect(
      seedEnvSchema.safeParse({ DATABASE_URL: testEnv.DATABASE_URL }).success,
    ).toBe(true);
  });

  it('accepts blank SEED_ADMIN_ variables, which only matter when no Admin exists', () => {
    expect(
      seedEnvSchema.safeParse({
        DATABASE_URL: testEnv.DATABASE_URL,
        SEED_ADMIN_EMAIL: '',
        SEED_ADMIN_PASSWORD: '',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(seedEnvSchema.safeParse({}).success).toBe(false);
  });
});
