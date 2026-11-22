import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeedModule } from '../src/seed.module.js';
import { seedFirstAdmin } from '../src/users/first-admin.js';
import { UsersService } from '../src/users/users.service.js';
import { testEnv } from './support/test-app.js';
import { PASSWORD } from './support/users.js';

describe('The seed module (pnpm db:seed)', () => {
  let seedModule: TestingModule;
  let users: UsersService;

  beforeEach(async () => {
    // The seed has the database and nothing else: no secret, no LiveKit.
    vi.stubEnv('DATABASE_URL', testEnv.DATABASE_URL);
    for (const name of [
      'JWT_SECRET',
      'AGENT_API_KEY',
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
      'AGENT_NAME',
    ]) {
      vi.stubEnv(name, undefined);
    }
    seedModule = await Test.createTestingModule({
      imports: [await SeedModule.register()],
    }).compile();
    users = seedModule.get(UsersService);
  });

  afterEach(async () => {
    await seedModule.close();
    vi.unstubAllEnvs();
  });

  it('creates the first Admin from DATABASE_URL and the SEED_ADMIN_ variables alone', async () => {
    const seed = await seedFirstAdmin(users, {
      SEED_ADMIN_EMAIL: 'grace@example.test',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    expect(seed.outcome).toBe('created');
    expect((await users.findByEmail('grace@example.test'))?.role).toBe('admin');
  });

  it('does nothing when an Admin exists, even with blank SEED_ADMIN_ variables', async () => {
    await seedFirstAdmin(users, {
      SEED_ADMIN_EMAIL: 'grace@example.test',
      SEED_ADMIN_PASSWORD: PASSWORD,
    });

    await expect(
      seedFirstAdmin(users, { SEED_ADMIN_EMAIL: '', SEED_ADMIN_PASSWORD: '' }),
    ).resolves.toEqual({ outcome: 'admin-exists' });
  });
});
