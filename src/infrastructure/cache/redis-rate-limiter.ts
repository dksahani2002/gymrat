import { Injectable } from '@nestjs/common';
import { RateLimiterPort } from '../../application/identity/ports/rate-limiter.port';
import { RedisService } from '../cache/redis.module';

@Injectable()
export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly redis: RedisService) {}

  hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    return this.redis.hit(key, limit, windowSeconds);
  }
}
