import {
  computeOverloadRecommendation,
  roundToIncrement,
} from './overload.algorithm';

function session(
  performedAt: string,
  sets: Array<{
    weightKg?: number | null;
    reps: number;
    rpe?: number | null;
    isFailure?: boolean;
    isWarmup?: boolean;
  }>,
) {
  return {
    performedAt: new Date(performedAt),
    sets: sets.map((set) => ({
      weightKg: set.weightKg ?? null,
      reps: set.reps,
      rpe: set.rpe ?? null,
      isWarmup: set.isWarmup ?? false,
      isFailure: set.isFailure ?? false,
    })),
  };
}

describe('computeOverloadRecommendation', () => {
  it('returns generic suggestion with insufficient_data when no history', () => {
    const result = computeOverloadRecommendation({ sessions: [] });
    expect(result.classification).toBe('INSUFFICIENT_DATA');
    expect(result.generic).toBe(true);
    expect(result.suggestion?.rationale).toMatch(/No history/i);
  });

  it('adds barbell increment after a successful session', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-07-20T12:00:00Z', [
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
        ]),
      ],
      equipmentSlug: 'barbell',
      goal: 'BUILD_MUSCLE',
      now: new Date('2026-07-21T12:00:00Z'),
    });

    expect(result.classification).toBe('SUCCESS');
    expect(result.suggestion?.weightKg).toBe(82.5);
    expect(result.suggestion?.reps).toBe(5);
    expect(result.baseline?.weightKg).toBe(80);
  });

  it('uses double progression for strength goals', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-07-20T12:00:00Z', [{ weightKg: 100, reps: 3 }]),
      ],
      equipmentSlug: 'barbell',
      goal: 'STRENGTH',
      now: new Date('2026-07-21T12:00:00Z'),
    });

    expect(result.suggestion?.weightKg).toBe(100);
    expect(result.suggestion?.reps).toBe(4);
  });

  it('adds weight and resets reps at top of strength range', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-07-20T12:00:00Z', [{ weightKg: 100, reps: 5 }]),
      ],
      equipmentSlug: 'barbell',
      goal: 'STRENGTH',
      now: new Date('2026-07-21T12:00:00Z'),
    });

    expect(result.suggestion?.weightKg).toBe(102.5);
    expect(result.suggestion?.reps).toBe(1);
  });

  it('deloads after consecutive underperforms', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-07-22T12:00:00Z', [
          { weightKg: 80, reps: 3, isFailure: true },
        ]),
        session('2026-07-20T12:00:00Z', [
          { weightKg: 80, reps: 2, isFailure: true },
        ]),
        session('2026-07-18T12:00:00Z', [{ weightKg: 80, reps: 5 }]),
      ],
      equipmentSlug: 'barbell',
      goal: 'BUILD_MUSCLE',
      now: new Date('2026-07-23T12:00:00Z'),
    });

    expect(result.flags).toContain('deload');
    expect(result.suggestion?.weightKg).toBe(72.5);
  });

  it('treats low RPE success as overperform via prior target', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-07-22T12:00:00Z', [
          { weightKg: 80, reps: 5, rpe: 6 },
          { weightKg: 80, reps: 5, rpe: 6 },
        ]),
        session('2026-07-20T12:00:00Z', [
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
        ]),
      ],
      equipmentSlug: 'barbell',
      goal: 'BUILD_MUSCLE',
      now: new Date('2026-07-23T12:00:00Z'),
    });

    expect(result.classification).toBe('OVERPERFORM');
    expect(result.suggestion?.weightKg).toBe(82.5);
  });

  it('applies detrain adjustment after long layoff', () => {
    const result = computeOverloadRecommendation({
      sessions: [
        session('2026-06-01T12:00:00Z', [{ weightKg: 100, reps: 5 }]),
      ],
      equipmentSlug: 'barbell',
      goal: 'BUILD_MUSCLE',
      now: new Date('2026-07-01T12:00:00Z'),
    });

    expect(result.flags).toContain('detrain_adjust');
    expect(result.suggestion?.weightKg).toBeLessThan(102.5);
  });

  it('rounds to equipment increment', () => {
    expect(roundToIncrement(81.2, 2.5)).toBe(80);
    expect(roundToIncrement(81.3, 2.5)).toBe(82.5);
    expect(roundToIncrement(81, 2)).toBe(82);
  });
});
