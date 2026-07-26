import { DomainEvent } from '../../common/domain-event.base';

export class UserRegisteredEvent extends DomainEvent {
  readonly eventName = 'identity.user.registered';

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    super();
  }
}

export class UserLoggedInEvent extends DomainEvent {
  readonly eventName = 'identity.user.logged_in';

  constructor(
    public readonly userId: string,
    public readonly ip: string | null,
  ) {
    super();
  }
}

export class PasswordResetRequestedEvent extends DomainEvent {
  readonly eventName = 'identity.password_reset.requested';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly resetToken: string,
  ) {
    super();
  }
}

export class RefreshTokenRotatedEvent extends DomainEvent {
  readonly eventName = 'identity.refresh_token.rotated';

  constructor(
    public readonly userId: string,
    public readonly familyId: string,
  ) {
    super();
  }
}

export class RefreshTokenReuseDetectedEvent extends DomainEvent {
  readonly eventName = 'identity.refresh_token.reuse_detected';

  constructor(
    public readonly userId: string,
    public readonly familyId: string,
  ) {
    super();
  }
}
