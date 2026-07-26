export type PerformanceClass =
  | 'SUCCESS'
  | 'OVERPERFORM'
  | 'UNDERPERFORM'
  | 'MIXED'
  | 'MARGINAL_SUCCESS'
  | 'INSUFFICIENT_DATA';

export type OverloadGoal =
  | 'STRENGTH'
  | 'BUILD_MUSCLE'
  | 'ENDURANCE'
  | 'LOSE_FAT'
  | 'GENERAL_FITNESS'
  | 'RECOMPOSITION';

export interface OverloadConfig {
  lookbackSessions: number;
  barbellIncrementKg: number;
  dumbbellIncrementKg: number;
  deloadConsecutiveFails: number;
  deloadPercent: number;
  detrainDays: number;
}

export const DEFAULT_OVERLOAD_CONFIG: OverloadConfig = {
  lookbackSessions: 3,
  barbellIncrementKg: 2.5,
  dumbbellIncrementKg: 2,
  deloadConsecutiveFails: 2,
  deloadPercent: 0.1,
  detrainDays: 14,
};

export interface OverloadSet {
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
  isFailure: boolean;
}

export interface OverloadSession {
  performedAt: Date;
  sets: OverloadSet[];
}

export interface OverloadSuggestion {
  weightKg: number | null;
  reps: number;
  sets: number;
  rationale: string;
}

export interface OverloadResult {
  classification: PerformanceClass;
  confidence: number;
  flags: string[];
  baseline: {
    weightKg: number | null;
    reps: number;
    sets: number;
    performedAt: Date;
  } | null;
  suggestion: OverloadSuggestion | null;
  generic: boolean;
}

function workingSets(sets: OverloadSet[]): OverloadSet[] {
  return sets.filter((set) => !set.isWarmup);
}

function topSet(sets: OverloadSet[]): OverloadSet | null {
  const working = workingSets(sets).filter(
    (set) => set.weightKg !== null && set.reps !== null && set.reps > 0,
  );
  if (working.length === 0) {
    const repsOnly = workingSets(sets).filter(
      (set) => set.reps !== null && set.reps > 0,
    );
    if (repsOnly.length === 0) return null;
    return repsOnly.reduce((best, set) =>
      (set.reps ?? 0) > (best.reps ?? 0) ? set : best,
    );
  }
  return working.reduce((best, set) => {
    if ((set.weightKg ?? 0) > (best.weightKg ?? 0)) return set;
    if (
      (set.weightKg ?? 0) === (best.weightKg ?? 0) &&
      (set.reps ?? 0) > (best.reps ?? 0)
    ) {
      return set;
    }
    return best;
  });
}

export function roundToIncrement(weightKg: number, incrementKg: number): number {
  if (incrementKg <= 0) {
    return Math.round(weightKg * 100) / 100;
  }
  return Math.round(weightKg / incrementKg) * incrementKg;
}

export function equipmentIncrementKg(
  equipmentSlug: string | null | undefined,
  config: OverloadConfig,
): number {
  const slug = (equipmentSlug ?? '').toLowerCase();
  if (slug.includes('dumbbell') || slug.includes('kettlebell')) {
    return config.dumbbellIncrementKg;
  }
  if (slug.includes('bodyweight')) {
    return 0;
  }
  return config.barbellIncrementKg;
}

function goalProfile(goal: OverloadGoal | null | undefined): {
  mode: 'strength' | 'hypertrophy' | 'endurance';
  repMin: number;
  repMax: number;
} {
  if (goal === 'STRENGTH') {
    return { mode: 'strength', repMin: 1, repMax: 5 };
  }
  if (goal === 'ENDURANCE') {
    return { mode: 'endurance', repMin: 12, repMax: 20 };
  }
  return { mode: 'hypertrophy', repMin: 6, repMax: 12 };
}

function classifySession(
  session: OverloadSession,
  targetReps: number,
): PerformanceClass {
  const sets = workingSets(session.sets);
  if (sets.length === 0) return 'INSUFFICIENT_DATA';

  if (sets.some((set) => set.isFailure)) {
    return 'UNDERPERFORM';
  }

  let hits = 0;
  let exceeds = 0;
  let misses = 0;
  for (const set of sets) {
    const reps = set.reps ?? 0;
    if (reps > targetReps) exceeds += 1;
    else if (reps >= targetReps) hits += 1;
    else misses += 1;
  }

  const n = sets.length;
  if (misses / n >= 0.5) return 'UNDERPERFORM';
  if (exceeds / n >= 0.5) return 'OVERPERFORM';
  if (misses > 0 && exceeds > 0) return 'MIXED';
  if (misses > 0) return 'MIXED';
  if (hits === n) {
    const rpes = sets
      .map((set) => set.rpe)
      .filter((rpe): rpe is number => rpe !== null);
    if (rpes.length > 0) {
      const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
      if (avg <= 7) return 'OVERPERFORM';
      if (avg >= 9) return 'MARGINAL_SUCCESS';
    }
    return 'SUCCESS';
  }
  return 'MIXED';
}

function consecutiveUnderperforms(
  sessionsNewestFirst: OverloadSession[],
): number {
  let count = 0;
  for (let i = 0; i < sessionsNewestFirst.length; i += 1) {
    const session = sessionsNewestFirst[i];
    const previous = sessionsNewestFirst[i + 1];
    const top = topSet(session.sets);
    if (!top || top.reps === null) break;
    const target = previous ? (topSet(previous.sets)?.reps ?? top.reps) : top.reps;
    const cls =
      !previous && !workingSets(session.sets).some((s) => s.isFailure)
        ? 'SUCCESS'
        : classifySession(session, target);
    if (cls === 'UNDERPERFORM') count += 1;
    else break;
  }
  return count;
}

/**
 * Pure progressive-overload recommendation from recent session history.
 * `sessions` must be newest-first.
 */
export function computeOverloadRecommendation(input: {
  sessions: OverloadSession[];
  goal?: OverloadGoal | null;
  equipmentSlug?: string | null;
  now?: Date;
  config?: Partial<OverloadConfig>;
}): OverloadResult {
  const config: OverloadConfig = {
    ...DEFAULT_OVERLOAD_CONFIG,
    ...input.config,
  };
  const now = input.now ?? new Date();
  const sessions = input.sessions.slice(0, config.lookbackSessions);
  const flags: string[] = [];

  if (sessions.length === 0) {
    return {
      classification: 'INSUFFICIENT_DATA',
      confidence: 0,
      flags: ['insufficient_data'],
      baseline: null,
      suggestion: {
        weightKg: null,
        reps: goalProfile(input.goal).repMin,
        sets: 3,
        rationale:
          'No history for this exercise yet. Use a conservative starter set and log it to unlock personalized overload.',
      },
      generic: true,
    };
  }

  const last = sessions[0];
  const baselineSet = topSet(last.sets);
  if (!baselineSet || baselineSet.reps === null) {
    return {
      classification: 'INSUFFICIENT_DATA',
      confidence: 0.2,
      flags: ['insufficient_data'],
      baseline: null,
      suggestion: null,
      generic: true,
    };
  }

  const baselineWeight = baselineSet.weightKg;
  const baselineReps = baselineSet.reps;
  const setsCount = workingSets(last.sets).length;
  const previousTop = sessions[1] ? topSet(sessions[1].sets) : null;
  const targetReps = previousTop?.reps ?? baselineReps;
  const classification =
    sessions.length === 1 && !workingSets(last.sets).some((s) => s.isFailure)
      ? 'SUCCESS'
      : classifySession(last, targetReps);
  const profile = goalProfile(input.goal ?? null);
  const increment = equipmentIncrementKg(input.equipmentSlug, config);
  const fails = consecutiveUnderperforms(sessions);

  let nextWeight = baselineWeight;
  let nextReps = baselineReps;
  let rationale = '';

  const daysSince = Math.floor(
    (now.getTime() - last.performedAt.getTime()) / 86_400_000,
  );

  if (fails >= config.deloadConsecutiveFails && baselineWeight !== null) {
    nextWeight = roundToIncrement(
      baselineWeight * (1 - config.deloadPercent),
      increment || 2.5,
    );
    nextReps = profile.repMin;
    rationale = `${fails} consecutive underperform sessions; deloading ~${Math.round(config.deloadPercent * 100)}%.`;
    flags.push('deload');
  } else if (profile.mode === 'strength') {
    if (baselineReps < profile.repMax) {
      nextWeight = baselineWeight;
      nextReps = Math.min(baselineReps + 1, profile.repMax);
      rationale = `Double progression: hold ${baselineWeight ?? 0}kg and add a rep (${nextReps}).`;
    } else if (baselineWeight !== null && increment > 0) {
      nextWeight = roundToIncrement(baselineWeight + increment, increment);
      nextReps = profile.repMin;
      rationale = `Hit top of strength range; adding ${increment}kg and resetting to ${profile.repMin} reps.`;
    } else {
      nextReps = baselineReps + 1;
      rationale = 'Bodyweight/strength: add a rep at the same load.';
    }
  } else if (profile.mode === 'endurance') {
    if (
      classification === 'SUCCESS' ||
      classification === 'OVERPERFORM' ||
      classification === 'MARGINAL_SUCCESS'
    ) {
      nextReps = Math.min(baselineReps + 2, profile.repMax);
      nextWeight = baselineWeight;
      rationale = `Endurance bias: keep load and push reps toward ${profile.repMax}.`;
      if (baselineReps >= profile.repMax && baselineWeight !== null && increment > 0) {
        nextWeight = roundToIncrement(baselineWeight + increment, increment);
        nextReps = profile.repMin;
        rationale = `Endurance range topped out; adding ${increment}kg and resetting reps.`;
      }
    } else if (classification === 'UNDERPERFORM') {
      nextReps = Math.max(baselineReps - 2, profile.repMin);
      rationale = 'Underperformed; hold load and reduce target reps.';
    } else {
      rationale = 'Mixed session; repeating last prescription.';
    }
  } else {
    // Hypertrophy / general
    if (classification === 'OVERPERFORM' || classification === 'SUCCESS') {
      if (baselineWeight !== null && increment > 0) {
        nextWeight = roundToIncrement(baselineWeight + increment, increment);
        nextReps = baselineReps;
        rationale = `Last session classified ${classification} at ${baselineWeight}×${baselineReps}; applying +${increment}kg.`;
      } else {
        nextReps = Math.min(baselineReps + 1, profile.repMax);
        rationale = `Progress via reps (no load increment for this equipment).`;
      }
    } else if (classification === 'MARGINAL_SUCCESS') {
      nextWeight = baselineWeight;
      nextReps =
        baselineReps < profile.repMax ? baselineReps + 1 : baselineReps;
      rationale =
        'High RPE success — hold weight and nudge reps if under range top.';
    } else if (classification === 'UNDERPERFORM') {
      if (baselineWeight !== null && increment > 0) {
        nextWeight = roundToIncrement(
          baselineWeight * 0.975,
          increment,
        );
        rationale =
          'Underperformed; reducing load ~2.5% and holding rep target.';
      } else {
        nextReps = Math.max(baselineReps - 1, profile.repMin);
        rationale = 'Underperformed; reduce target reps and retry.';
      }
    } else {
      rationale = 'Mixed performance; repeating last top set prescription.';
    }
  }

  if (daysSince > config.detrainDays && nextWeight !== null) {
    const factor = daysSince > 21 ? 0.9 : 0.95;
    nextWeight = roundToIncrement(nextWeight * factor, increment || 2.5);
    flags.push('detrain_adjust');
    rationale += ` Adjusted −${Math.round((1 - factor) * 100)}% after ${daysSince} days since last session.`;
  }

  const confidence =
    sessions.length >= 3
      ? 0.9
      : sessions.length === 2
        ? 0.75
        : 0.55;

  return {
    classification,
    confidence,
    flags,
    baseline: {
      weightKg: baselineWeight,
      reps: baselineReps,
      sets: Math.max(setsCount, 1),
      performedAt: last.performedAt,
    },
    suggestion: {
      weightKg: nextWeight,
      reps: nextReps,
      sets: Math.max(setsCount, 1),
      rationale: rationale.trim(),
    },
    generic: false,
  };
}
