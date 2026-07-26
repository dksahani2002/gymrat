/**
 * Converts display weight to normalized kilograms for analytics.
 */
export function toWeightKg(weight: number, unit: 'KG' | 'LB'): number {
  if (unit === 'LB') {
    return Math.round((weight * 0.45359237) * 100) / 100;
  }
  return Math.round(weight * 100) / 100;
}
