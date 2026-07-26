/**
 * Progress toward a numeric target.
 * For BODY_WEIGHT loss goals, pass baseline > target and current decreasing.
 */
export function computeProgressPercent(input: {
  baseline: number | null;
  current: number | null;
  target: number | null;
}): number | null {
  const { baseline, current, target } = input;
  if (current === null || target === null) {
    return null;
  }

  // Count-up goals (strength, frequency, volume, bodyweight gain)
  if (baseline === null || baseline === target) {
    if (target === 0) return current >= 0 ? 1 : 0;
    return clamp(current / target);
  }

  const span = target - baseline;
  if (span === 0) {
    return current === target ? 1 : 0;
  }

  return clamp((current - baseline) / span);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}
