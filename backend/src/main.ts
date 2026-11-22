import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import type { BackendEnv } from './config/env.schema.js';

const app = await NestFactory.create<NestExpressApplication>(
  await AppModule.register(),
  { logger: new ConsoleLogger({ json: true }) },
);
configureApp(app);
app.enableShutdownHooks();
await app.listen(
  app
    .get<ConfigService<BackendEnv, true>>(ConfigService)
    .getOrThrow('PORT', { infer: true }),
);
