import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);
  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  const nodeEnv = config.get<string>('nodeEnv', 'development');

  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.use(
    helmet({
      // HSTS on localhost causes browsers to force https:// → ERR_EMPTY_RESPONSE
      hsts: nodeEnv === 'production',
      contentSecurityPolicy:
        nodeEnv === 'production'
          ? undefined
          : {
              useDefaults: true,
              directives: {
                // Swagger UI loads inline scripts/styles in development
                'script-src': ["'self'", "'unsafe-inline'"],
                'style-src': ["'self'", "'unsafe-inline'", 'https:'],
                'upgrade-insecure-requests': null,
              },
            },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: config.get<string>('frontendUrl'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GymRat API')
      .setDescription('AI Fitness Platform — Phase 1 Auth')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  if (nodeEnv !== 'production') {
    Logger.log(`Swagger at http://localhost:${port}/docs`, 'Bootstrap');
  }
}

void bootstrap();
