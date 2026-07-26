export const RATE_LIMITER_PORT = Symbol('RATE_LIMITER_PORT');

/**
 * Port for distributed rate limiting (Redis-backed in infrastructure).
 */
export interface RateLimiterPort {
  /**
   * Records a hit and returns true when the caller is still within the limit.
   */
  hit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}
