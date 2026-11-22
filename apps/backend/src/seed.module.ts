import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { seedEnvSchema } from './config/env.schema.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

/** What `pnpm db:seed` needs from the application: the database and the Users. */
@Module({ imports: [PrismaModule, UsersModule] })
export class SeedModule {
  /** The seed module with its validated environment, like `AppModule.register`. */
  static async register(): Promise<DynamicModule> {
    return {
      module: SeedModule,
      imports: [
        await ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validationSchema: seedEnvSchema,
        }),
      ],
    };
  }
}
