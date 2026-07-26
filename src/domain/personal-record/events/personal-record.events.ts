import { DomainEvent } from '../../common/domain-event.base';
import { PrType } from '../pr-type.enum';

export class PersonalRecordAchievedEvent extends DomainEvent {
  readonly eventName = 'pr.achieved';

  constructor(
    public readonly personalRecordId: string,
    public readonly userId: string,
    public readonly exerciseId: string,
    public readonly type: PrType,
    public readonly value: number,
    public readonly unit: string | null,
    public readonly workoutId: string | null,
    public readonly achievedAt: Date,
  ) {
    super();
  }
}
