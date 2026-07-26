import {
  addDaysKey,
  computeStreak,
  dateKeyInTimeZone,
  setVolumeKg,
  weekStartKey,
} from './analytics.helpers';

describe('analytics.helpers', () => {
  it('formats date keys in a timezone', () => {
    const utc = new Date('2026-07-26T18:30:00.000Z');
    expect(dateKeyInTimeZone(utc, 'UTC')).toBe('2026-07-26');
    expect(dateKeyInTimeZone(utc, 'Asia/Kolkata')).toBe('2026-07-27');
  });

  it('computes ISO week start (Monday)', () => {
    expect(weekStartKey('2026-07-26')).toBe('2026-07-20'); // Sunday -> prior Monday
    expect(weekStartKey('2026-07-20')).toBe('2026-07-20');
  });

  it('computes streak ending today or yesterday', () => {
    expect(
      computeStreak(['2026-07-24', '2026-07-25', '2026-07-26'], '2026-07-26'),
    ).toBe(3);
    expect(computeStreak(['2026-07-24', '2026-07-25'], '2026-07-26')).toBe(2);
    expect(computeStreak(['2026-07-20'], '2026-07-26')).toBe(0);
  });

  it('adds days to a date key', () => {
    expect(addDaysKey('2026-07-26', -1)).toBe('2026-07-25');
  });

  it('computes set volume', () => {
    expect(setVolumeKg(80, 5)).toBe(400);
    expect(setVolumeKg(null, 5)).toBe(0);
  });
});
