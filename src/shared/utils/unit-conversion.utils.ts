/**
 * Converts display weight to normalized kilograms for analytics.
 */
export function toWeightKg(weight: number, unit: 'KG' | 'LB'): number {
  if (unit === 'LB') {
    return Math.round(weight * 0.45359237 * 100) / 100;
  }
  return Math.round(weight * 100) / 100;
}

/**
 * Converts normalized kilograms to the user's preferred display unit.
 */
export function fromWeightKg(weightKg: number, unit: 'KG' | 'LB'): number {
  if (unit === 'LB') {
    return Math.round((weightKg / 0.45359237) * 100) / 100;
  }
  return Math.round(weightKg * 100) / 100;
}
