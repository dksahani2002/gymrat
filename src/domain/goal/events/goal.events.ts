import { DomainEvent } from '../../common/domain-event.base';
import { GoalType } from '../goal.enums';

export class GoalCreatedEvent extends DomainEvent {
  readonly eventName = 'goal.created';

  constructor(
    public readonly goalId: string,
    public readonly userId: string,
    public readonly type: GoalType,
  ) {
    super();
  }
}

export class GoalCompletedEvent extends DomainEvent {
  readonly eventName = 'goal.completed';

  constructor(
    public readonly goalId: string,
    public readonly userId: string,
    public readonly type: GoalType,
  ) {
    super();
  }
}

export class GoalDeletedEvent extends DomainEvent {
  readonly eventName = 'goal.deleted';

  constructor(
    public readonly goalId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
