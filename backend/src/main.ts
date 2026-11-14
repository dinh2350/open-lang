import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

const { PORT } = z
  .object({ PORT: z.coerce.number().int().positive().default(3000) })
  .parse(process.env);

const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({ json: true }),
});
configureApp(app);
app.enableShutdownHooks();
await app.listen(PORT);
