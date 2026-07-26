import { Inject, Injectable, Logger } from '@nestjs/common';
import { PersonalRecordAchievedEvent } from '../../domain/personal-record/events/personal-record.events';
import {
  detectPrCandidates,
  filterNewPrs,
} from '../../domain/personal-record/pr-detection';
import { PrType } from '../../domain/personal-record/pr-type.enum';
import {
  PERSONAL_RECORD_REPOSITORY,
  PersonalRecordRepository,
} from '../../domain/personal-record/repositories/personal-record.repository';
import {
  WORKOUT_REPOSITORY,
  WorkoutRepository,
} from '../../domain/workout/repositories/workout.repository';
import { EVENT_BUS, EventBusPort } from '../../shared/events/event-bus.port';

export interface PersonalRecordView {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string | null;
  exerciseSlug: string | null;
  type: PrType;
  value: number;
  unit: string | null;
  workoutId: string | null;
  achievedAt: Date;
  createdAt: Date;
}

/**
 * Personal record queries and workout-complete detection.
 */
@Injectable()
export class PersonalRecordsApplicationService {
  private readonly logger = new Logger(PersonalRecordsApplicationService.name);

  constructor(
    @Inject(PERSONAL_RECORD_REPOSITORY)
    private readonly records: PersonalRecordRepository,
    @Inject(WORKOUT_REPOSITORY) private readonly workouts: WorkoutRepository,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async list(input: {
    userId: string;
    exerciseId?: string;
    type?: PrType;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ items: PersonalRecordView[]; nextCursor: string | null }> {
    const result = await this.records.list({
      userId: input.userId,
      exerciseId: input.exerciseId,
      type: input.type,
      from: input.from,
      to: input.to,
      limit: Math.min(Math.max(input.limit ?? 20, 1), 100),
      cursor: input.cursor,
    });
    return {
      items: result.items.map((item) => this.toView(item)),
      nextCursor: result.nextCursor,
    };
  }

  async summary(userId: string): Promise<PersonalRecordView[]> {
    const bests = await this.records.findBests(userId);
    return bests
      .map((item) => this.toView(item))
      .sort((a, b) => {
        const nameA = a.exerciseName ?? '';
        const nameB = b.exerciseName ?? '';
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.type.localeCompare(b.type);
      });
  }

  /**
   * Detect and persist new PRs for a completed workout. Idempotent per workout.
   */
  async detectForCompletedWorkout(input: {
    workoutId: string;
    userId: string;
    completedAt: Date;
  }): Promise<PersonalRecordView[]> {
    const workout = await this.workouts.findByIdForUser(
      input.workoutId,
      input.userId,
    );
    if (!workout || workout.deletedAt) {
      this.logger.warn(
        `Skipping PR detection: workout ${input.workoutId} not found for user`,
      );
      return [];
    }

    const candidates = detectPrCandidates(workout);
    if (candidates.length === 0) {
      return [];
    }

    const exerciseIds = [...new Set(candidates.map((c) => c.exerciseId))];
    const bests = await this.records.findBests(input.userId, exerciseIds);
    const newOnes = filterNewPrs(
      candidates,
      bests.map((b) => ({
        exerciseId: b.exerciseId,
        type: b.type,
        value: b.value,
      })),
    );

    if (newOnes.length === 0) {
      return [];
    }

    const achievedAt = workout.completedAt ?? input.completedAt;
    const created = await this.records.createMany(
      newOnes.map((candidate) => ({
        userId: input.userId,
        exerciseId: candidate.exerciseId,
        type: candidate.type,
        value: candidate.value,
        unit: candidate.unit,
        workoutId: workout.id,
        achievedAt,
      })),
    );

    for (const record of created) {
      const event = new PersonalRecordAchievedEvent(
        record.id,
        record.userId,
        record.exerciseId,
        record.type,
        record.value,
        record.unit,
        record.workoutId,
        record.achievedAt,
      );
      this.events.publish(event.eventName, event);
    }

    this.logger.log(
      `Detected ${created.length} PR(s) for workout ${workout.id}`,
    );
    return created.map((item) => this.toView(item));
  }

  private toView(record: {
    id: string;
    userId: string;
    exerciseId: string;
    exerciseName?: string;
    exerciseSlug?: string;
    type: PrType;
    value: number;
    unit: string | null;
    workoutId: string | null;
    achievedAt: Date;
    createdAt: Date;
  }): PersonalRecordView {
    return {
      id: record.id,
      userId: record.userId,
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName ?? null,
      exerciseSlug: record.exerciseSlug ?? null,
      type: record.type,
      value: record.value,
      unit: record.unit,
      workoutId: record.workoutId,
      achievedAt: record.achievedAt,
      createdAt: record.createdAt,
    };
  }
}
