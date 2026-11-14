import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Application-wide settings, shared by `main.ts` and the S1 tests. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // The frontend's dev proxy runs on this host and forwards each browser's
  // IP in X-Forwarded-For, so rate limits count per browser. Only a proxy on
  // the loopback interface is trusted with that header; a client elsewhere
  // can't choose its own IP.
  app.set('trust proxy', 'loopback');
}
