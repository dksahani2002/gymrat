import { DomainEvent } from '../../common/domain-event.base';

export class BodyWeightLoggedEvent extends DomainEvent {
  readonly eventName = 'body_weight.logged';

  constructor(
    public readonly entryId: string,
    public readonly userId: string,
    public readonly weightKg: number,
    public readonly recordedAt: Date,
  ) {
    super();
  }
}

export class BodyWeightDeletedEvent extends DomainEvent {
  readonly eventName = 'body_weight.deleted';

  constructor(
    public readonly entryId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
