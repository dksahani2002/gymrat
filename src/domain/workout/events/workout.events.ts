import { DomainEvent } from '../../common/domain-event.base';

export class WorkoutCompletedEvent extends DomainEvent {
  readonly eventName = 'workout.completed';

  constructor(
    public readonly workoutId: string,
    public readonly userId: string,
    public readonly completedAt: Date,
  ) {
    super();
  }
}

export class WorkoutDeletedEvent extends DomainEvent {
  readonly eventName = 'workout.deleted';

  constructor(
    public readonly workoutId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
