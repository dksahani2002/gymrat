export const AI_WORKOUT_PARSER = Symbol('AI_WORKOUT_PARSER');

export type WeightUnitHint = 'KG' | 'LB';

export interface ParsedSetCandidate {
  weight?: number;
  reps?: number;
  unit?: WeightUnitHint;
  rpe?: number;
}

export interface ParsedExerciseCandidate {
  rawName: string;
  sets: ParsedSetCandidate[];
  notes?: string;
}

export interface RawParseResult {
  title?: string;
  exercises: ParsedExerciseCandidate[];
  providerMeta: {
    provider: string;
    model: string;
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

/**
 * Port for natural-language → structured workout candidates.
 */
export interface AiWorkoutParserPort {
  parse(input: {
    text: string;
    unitHint?: WeightUnitHint;
    locale?: string;
  }): Promise<RawParseResult>;
}
