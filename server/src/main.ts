// src/main.ts
import './instrument'; // MUST stay first — initializes Sentry before any module is imported
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { RedisIoAdapter } from '@modules/realtime/adapters/redis-io.adapter';

async function bootstrap() {
  // bufferLogs holds early framework logs until the pino logger is attached.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // pino becomes the Nest logger
  const config = app.get(ConfigService);

  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();

  app.useWebSocketAdapter(redisAdapter);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  // Exception filters are registered as APP_FILTER providers in AppModule so they
  // can inject the pino logger (see src/common/filters/*).

  app.use(cookieParser());
  app.use(helmet());
  app.use(compression());

  app.enableCors({ origin: config.get<string>('webOrigin'), credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.get<number>('port') ?? 4000);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console -- Logger may be unavailable on early bootstrap failure
  console.error(err);
  process.exit(1);
});
