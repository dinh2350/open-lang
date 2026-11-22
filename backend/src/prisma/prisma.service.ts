import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseEnv } from '@open-live-agent/shared';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

/** The Prisma client for the backend's Postgres (ADR 0002). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const { DATABASE_URL } = parseEnv(
      databaseEnvSchema,
      process.env,
      'Invalid database settings in the backend environment',
    );
    super({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
