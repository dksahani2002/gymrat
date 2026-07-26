import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  computeOverloadRecommendation,
  OverloadConfig,
  OverloadGoal,
} from '../../domain/progressive-overload/overload.algorithm';
import {
  OVERLOAD_REPOSITORY,
  OverloadRepository,
} from '../../domain/progressive-overload/repositories/overload.repository';
import { RedisService } from '../../infrastructure/cache/redis.module';
import { NotFoundError } from '../../shared/errors/base.error';
import { fromWeightKg } from '../../shared/utils/unit-conversion.utils';

export interface OverloadRecommendationView {
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  suggestion: {
    weight: number | null;
    weightUnit: 'KG' | 'LB';
    weightKg: number | null;
    reps: number;
    sets: number;
    rationale: string;
  } | null;
  baseline: {
    weight: number | null;
    weightUnit: 'KG' | 'LB';
    weightKg: number | null;
    reps: number;
    sets: number;
    performedAt: Date;
  } | null;
  classification: string;
  confidence: number;
  flags: string[];
  generic: boolean;
}

/**
 * Progressive overload recommendations with Redis cache.
 */
@Injectable()
export class ProgressiveOverloadApplicationService {
  private readonly logger = new Logger(
    ProgressiveOverloadApplicationService.name,
  );

  constructor(
    @Inject(OVERLOAD_REPOSITORY) private readonly overload: OverloadRepository,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string): Promise<OverloadRecommendationView[]> {
    const cacheKey = `overload:${userId}:all`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OverloadRecommendationView[];
    }

    const recentDays = this.config.get<number>('overload.recentDays', 28);
    const exerciseIds = await this.overload.listRecentExerciseIds(
      userId,
      recentDays,
    );
    const items: OverloadRecommendationView[] = [];
    for (const exerciseId of exerciseIds) {
      items.push(await this.computeForExercise(userId, exerciseId));
    }

    const ttl = this.config.get<number>('overload.cacheTtlSec', 900);
    await this.redis.raw.set(cacheKey, JSON.stringify(items), 'EX', ttl);
    return items;
  }

  async getForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<OverloadRecommendationView> {
    const cacheKey = `overload:${userId}:ex:${exerciseId}`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OverloadRecommendationView;
    }

    const meta = await this.overload.getExerciseMeta(exerciseId);
    if (!meta) {
      throw new NotFoundError('Exercise not found');
    }

    const view = await this.computeForExercise(userId, exerciseId);
    const ttl = this.config.get<number>('overload.cacheTtlSec', 900);
    await this.redis.raw.set(cacheKey, JSON.stringify(view), 'EX', ttl);
    return view;
  }

  async invalidateUser(userId: string): Promise<void> {
    const keys = await this.redis.raw.keys(`overload:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.raw.del(...keys);
    }
    this.logger.debug(`Invalidated overload cache for user ${userId}`);
  }

  private async computeForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<OverloadRecommendationView> {
    const [meta, user, lookback] = await Promise.all([
      this.overload.getExerciseMeta(exerciseId),
      this.overload.getUserContext(userId),
      Promise.resolve(this.config.get<number>('overload.lookbackSessions', 3)),
    ]);

    if (!meta) {
      throw new NotFoundError('Exercise not found');
    }

    const sessions = await this.overload.getRecentSessions(
      userId,
      exerciseId,
      lookback,
    );

    const algoConfig: Partial<OverloadConfig> = {
      lookbackSessions: lookback,
      barbellIncrementKg: this.config.get<number>(
        'overload.barbellIncrementKg',
        2.5,
      ),
      dumbbellIncrementKg: this.config.get<number>(
        'overload.dumbbellIncrementKg',
        2,
      ),
      deloadConsecutiveFails: this.config.get<number>(
        'overload.deloadConsecutiveFails',
        2,
      ),
      deloadPercent: this.config.get<number>('overload.deloadPercent', 0.1),
      detrainDays: this.config.get<number>('overload.detrainDays', 14),
    };

    const result = computeOverloadRecommendation({
      sessions,
      goal: user.fitnessGoal as OverloadGoal | null,
      equipmentSlug: meta.equipmentSlug,
      config: algoConfig,
    });

    const unit = user.preferredWeightUnit;

    return {
      exerciseId: meta.exerciseId,
      exerciseName: meta.name,
      exerciseSlug: meta.slug,
      classification: result.classification,
      confidence: result.confidence,
      flags: result.flags,
      generic: result.generic,
      suggestion: result.suggestion
        ? {
            weight:
              result.suggestion.weightKg === null
                ? null
                : fromWeightKg(result.suggestion.weightKg, unit),
            weightUnit: unit,
            weightKg: result.suggestion.weightKg,
            reps: result.suggestion.reps,
            sets: result.suggestion.sets,
            rationale: result.suggestion.rationale,
          }
        : null,
      baseline: result.baseline
        ? {
            weight:
              result.baseline.weightKg === null
                ? null
                : fromWeightKg(result.baseline.weightKg, unit),
            weightUnit: unit,
            weightKg: result.baseline.weightKg,
            reps: result.baseline.reps,
            sets: result.baseline.sets,
            performedAt: result.baseline.performedAt,
          }
        : null,
    };
  }
}
