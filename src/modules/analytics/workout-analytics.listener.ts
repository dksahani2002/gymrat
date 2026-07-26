import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsApplicationService } from '../../application/analytics/analytics.application-service';
import {
  WorkoutCompletedEvent,
  WorkoutDeletedEvent,
} from '../../domain/workout/events/workout.events';

/**
 * Sync analytics recompute on workout lifecycle events (BullMQ later).
 */
@Injectable()
export class WorkoutAnalyticsListener {
  constructor(private readonly analytics: AnalyticsApplicationService) {}

  @OnEvent('workout.completed')
  async onCompleted(event: WorkoutCompletedEvent): Promise<void> {
    await this.analytics.recomputeForDate({
      userId: event.userId,
      anchorAt: event.completedAt,
    });
  }

  @OnEvent('workout.deleted')
  async onDeleted(event: WorkoutDeletedEvent): Promise<void> {
    await this.analytics.recomputeForDate({
      userId: event.userId,
      anchorAt: event.completedAt ?? event.startedAt,
    });
  }
}
