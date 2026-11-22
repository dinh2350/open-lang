// `pnpm db:seed`: creates the first Admin of a fresh database.
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module.js';
import { seedFirstAdmin } from './users/first-admin.js';
import { UsersService } from './users/users.service.js';

const logger = new ConsoleLogger('Seed', { json: true });
const app = await NestFactory.createApplicationContext(SeedModule, {
  logger: false,
});
try {
  const seed = await seedFirstAdmin(app.get(UsersService), process.env);
  if (seed.outcome === 'created') {
    logger.log({ message: 'Created the first Admin', userId: seed.userId });
  } else {
    logger.log('An Admin already exists, so the seed changed nothing');
  }
} finally {
  await app.close();
}
