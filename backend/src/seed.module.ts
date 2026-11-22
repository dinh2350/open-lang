import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

/** What `pnpm db:seed` needs from the application: the database and the Users. */
@Module({ imports: [PrismaModule, UsersModule] })
export class SeedModule {}
