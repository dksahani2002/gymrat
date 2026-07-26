import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProgressiveOverloadApplicationService } from '../../application/progressive-overload/progressive-overload.application-service';
import {
  WorkoutCompletedEvent,
  WorkoutDeletedEvent,
} from '../../domain/workout/events/workout.events';

@Injectable()
export class OverloadCacheListener {
  constructor(
    private readonly overload: ProgressiveOverloadApplicationService,
  ) {}

  @OnEvent('workout.completed')
  async onCompleted(event: WorkoutCompletedEvent): Promise<void> {
    await this.overload.invalidateUser(event.userId);
  }

  @OnEvent('workout.deleted')
  async onDeleted(event: WorkoutDeletedEvent): Promise<void> {
    await this.overload.invalidateUser(event.userId);
  }
}
