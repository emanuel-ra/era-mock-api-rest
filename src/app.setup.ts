import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import {
  MockBehaviorInterceptor,
  mockBehaviorOptionsFromConfig,
} from './core/interceptors/mock-behavior.interceptor';

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

  // x-mock-delay / x-mock-status headers and MOCK_DELAY_MS / MOCK_ERROR_RATE.
  app.useGlobalInterceptors(
    new MockBehaviorInterceptor(mockBehaviorOptionsFromConfig(app.get(ConfigService))),
  );
}
