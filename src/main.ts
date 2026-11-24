import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import {
  MAX_MOCK_DELAY_MS,
  MOCK_DELAY_HEADER,
  MOCK_STATUS_HEADER,
} from './core/interceptors/mock-behavior.interceptor';
import { setupApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  setupApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERA Mock API REST')
    .setDescription('Reusable mock REST API for frontend testing')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters(
      {
        name: MOCK_DELAY_HEADER,
        in: 'header',
        required: false,
        description: `Simulated latency in ms (0–${MAX_MOCK_DELAY_MS}). Overrides MOCK_DELAY_MS.`,
        schema: { type: 'integer', minimum: 0, maximum: MAX_MOCK_DELAY_MS },
      },
      {
        name: MOCK_STATUS_HEADER,
        in: 'header',
        required: false,
        description: 'Respond with this 4xx/5xx status without running the handler.',
        schema: { type: 'integer', minimum: 400, maximum: 599 },
      },
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`ERA Mock API running on http://localhost:${port}`);
  console.log(`Swagger docs:           http://localhost:${port}/api/docs`);
}

bootstrap();
