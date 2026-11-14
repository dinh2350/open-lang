import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';

/** Application-wide settings, shared by `main.ts` and the S1 tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
