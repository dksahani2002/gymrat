import { DomainEvent } from '../../common/domain-event.base';

export class BodyMeasurementLoggedEvent extends DomainEvent {
  readonly eventName = 'body_measurement.logged';

  constructor(
    public readonly entryId: string,
    public readonly userId: string,
    public readonly recordedAt: Date,
  ) {
    super();
  }
}

export class BodyMeasurementDeletedEvent extends DomainEvent {
  readonly eventName = 'body_measurement.deleted';

  constructor(
    public readonly entryId: string,
    public readonly userId: string,
  ) {
    super();
  }
}
