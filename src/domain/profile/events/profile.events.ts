import { DomainEvent } from '../../common/domain-event.base';

export class ProfileUpdatedEvent extends DomainEvent {
  readonly eventName = 'profile.updated';

  constructor(public readonly userId: string) {
    super();
  }
}

export class AccountDeletedEvent extends DomainEvent {
  readonly eventName = 'profile.account_deleted';

  constructor(public readonly userId: string) {
    super();
  }
}
