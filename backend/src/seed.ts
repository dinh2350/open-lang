// `pnpm db:seed`: creates the first Admin of a fresh database.
import { ConsoleLogger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { seedFirstAdmin } from './users/first-admin.js';

const logger = new ConsoleLogger('Seed', { json: true });
const prisma = new PrismaService();
try {
  const seed = await seedFirstAdmin(prisma, process.env);
  if (seed.outcome === 'created') {
    logger.log({ message: 'Created the first Admin', userId: seed.userId });
  } else {
    logger.log('An Admin already exists, so the seed changed nothing');
  }
} finally {
  await prisma.$disconnect();
}
