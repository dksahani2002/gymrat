export const EXERCISE_RESOLVER = Symbol('EXERCISE_RESOLVER');

export interface ResolvedExerciseMatch {
  id: string;
  name: string;
  slug: string;
  confidence: number;
}

export interface ExerciseResolution {
  rawName: string;
  resolved: ResolvedExerciseMatch | null;
  suggestions: ResolvedExerciseMatch[];
  ambiguous: boolean;
}

/**
 * Port for mapping free-text exercise names onto the catalog.
 */
export interface ExerciseResolverPort {
  resolve(rawName: string): Promise<ExerciseResolution>;
}
