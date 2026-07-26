import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database + redis)' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    await this.redis.raw.ping();
    return { status: 'ready' };
  }
}
