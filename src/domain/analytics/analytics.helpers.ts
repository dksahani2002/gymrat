/**
 * Local calendar helpers for timezone-aware analytics.
 */

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Monday (ISO) of the week containing dateKey, as UTC midnight date. */
export function weekStartKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const day = date.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function addDaysKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive training-day streak ending today (or yesterday if rest day today).
 */
export function computeStreak(
  trainedDateKeys: string[],
  todayKey: string,
): number {
  const set = new Set(trainedDateKeys);
  let cursor = set.has(todayKey) ? todayKey : addDaysKey(todayKey, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function setVolumeKg(
  weightKg: number | null,
  reps: number | null,
): number {
  if (weightKg === null || reps === null || reps <= 0 || weightKg < 0) {
    return 0;
  }
  return weightKg * reps;
}

export const SECONDARY_MUSCLE_FACTOR = 0.5;
