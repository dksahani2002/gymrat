import { computeProgressPercent } from './goal-progress';

describe('computeProgressPercent', () => {
  it('computes count-up progress from zero baseline', () => {
    expect(
      computeProgressPercent({ baseline: 0, current: 50, target: 100 }),
    ).toBe(0.5);
    expect(
      computeProgressPercent({ baseline: 0, current: 100, target: 100 }),
    ).toBe(1);
  });

  it('computes body-weight loss progress', () => {
    expect(
      computeProgressPercent({ baseline: 90, current: 85, target: 80 }),
    ).toBe(0.5);
    expect(
      computeProgressPercent({ baseline: 90, current: 80, target: 80 }),
    ).toBe(1);
  });

  it('computes body-weight gain progress', () => {
    expect(
      computeProgressPercent({ baseline: 70, current: 75, target: 80 }),
    ).toBe(0.5);
  });

  it('returns null when current or target missing', () => {
    expect(
      computeProgressPercent({ baseline: 0, current: null, target: 100 }),
    ).toBeNull();
  });
});
