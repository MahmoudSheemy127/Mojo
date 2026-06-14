// src/health/health.controller.ts
import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness + readiness probes for the platform (and a future Prometheus scraper).
 * Both routes are @Public() so the global JwtAuthGuard doesn't block them, and
 * excluded from request logging via autoLogging.ignore (app.module.ts).
 *
 * Liveness answers "is the process up?"; readiness answers "are deps reachable?".
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness — no dependency checks, just proves the event loop is serving.
  @Public()
  @Get()
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  // Readiness — 200 only when Postgres is reachable, else 503.
  // TODO: add a redis.ping() check here once RedisService is implemented.
  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<{ status: 'ok'; db: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database unreachable' });
    }
    return { status: 'ok', db: 'up' };
  }
}
