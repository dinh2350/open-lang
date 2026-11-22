// `pnpm db:seed`: creates the first Admin of a fresh database.
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { SeedEnv } from './config/env.schema.js';
import { SeedModule } from './seed.module.js';
import { seedFirstAdmin } from './users/first-admin.js';
import { UsersService } from './users/users.service.js';

const logger = new ConsoleLogger('Seed', { json: true });
const app = await NestFactory.createApplicationContext(
  await SeedModule.register(),
  { logger: false },
);
try {
  const config = app.get<ConfigService<SeedEnv, true>>(ConfigService);
  const seed = await seedFirstAdmin(app.get(UsersService), {
    SEED_ADMIN_EMAIL: config.get('SEED_ADMIN_EMAIL', { infer: true }),
    SEED_ADMIN_PASSWORD: config.get('SEED_ADMIN_PASSWORD', { infer: true }),
  });
  if (seed.outcome === 'created') {
    logger.log({ message: 'Created the first Admin', userId: seed.userId });
  } else {
    logger.log('An Admin already exists, so the seed changed nothing');
  }
} finally {
  await app.close();
}
