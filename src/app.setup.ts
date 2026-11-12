import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Global middleware and pipes shared by the real server (main.ts) and the
 * e2e tests, so both run the app with the same configuration.
 */
export function setupApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
