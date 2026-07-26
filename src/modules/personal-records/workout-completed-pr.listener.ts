import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PersonalRecordsApplicationService } from '../../application/personal-records/personal-records.application-service';
import { WorkoutCompletedEvent } from '../../domain/workout/events/workout.events';

/**
 * Sync PR detection on workout.completed (BullMQ later).
 */
@Injectable()
export class WorkoutCompletedPrListener {
  constructor(private readonly personalRecords: PersonalRecordsApplicationService) {}

  @OnEvent('workout.completed')
  async handle(event: WorkoutCompletedEvent): Promise<void> {
    await this.personalRecords.detectForCompletedWorkout({
      workoutId: event.workoutId,
      userId: event.userId,
      completedAt: event.completedAt,
    });
  }
}
