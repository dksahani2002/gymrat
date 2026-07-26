import { PersonalRecord } from './personal-record.entity';
import { PrType } from './pr-type.enum';

describe('PersonalRecord', () => {
  it('creates an append-only record', () => {
    const pr = PersonalRecord.create({
      id: 'pr-1',
      userId: 'user-1',
      exerciseId: 'ex-1',
      exerciseName: 'Bench',
      exerciseSlug: 'bench',
      type: PrType.MAX_WEIGHT,
      value: 100,
      unit: 'KG',
      workoutId: 'wo-1',
      achievedAt: new Date('2026-07-26T12:00:00Z'),
      createdAt: new Date('2026-07-26T12:00:00Z'),
    });

    expect(pr.id).toBe('pr-1');
    expect(pr.type).toBe(PrType.MAX_WEIGHT);
    expect(pr.value).toBe(100);
  });
});
