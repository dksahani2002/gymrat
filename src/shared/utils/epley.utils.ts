/**
 * Epley estimated 1RM. Only valid for reps 1–12.
 */
export function estimated1RmKg(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > 12) {
    return null;
  }
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}
