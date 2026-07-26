export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');

export interface DailySnapshotRecord {
  date: string;
  workoutCount: number;
  totalVolumeKg: number;
  totalDurationSec: number;
  setCount: number;
}

export interface WeeklySnapshotRecord {
  weekStart: string;
  workoutCount: number;
  totalVolumeKg: number;
  totalDurationSec: number;
  trainingDays: number;
}

export interface MuscleVolumeRecord {
  date: string;
  muscleGroupId: string;
  muscleGroupName: string;
  muscleGroupSlug: string;
  volumeKg: number;
  setCount: number;
}

export interface ExerciseStatRecord {
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastVolumeKg: number | null;
  bestWeightKg: number | null;
  bestEstimated1rmKg: number | null;
  totalSessions: number;
  lastPerformedAt: Date | null;
}

export interface ExerciseMuscleLink {
  exerciseId: string;
  muscleGroupId: string;
  role: 'PRIMARY' | 'SECONDARY';
}

export interface WorkoutAnalyticsSlice {
  id: string;
  completedAt: Date;
  durationSec: number | null;
  exercises: Array<{
    exerciseId: string;
    sets: Array<{
      reps: number | null;
      weightKg: number | null;
      isWarmup: boolean;
    }>;
  }>;
}

export interface ExerciseSeriesPoint {
  date: string;
  volumeKg: number;
  bestEstimated1rmKg: number | null;
  bestWeightKg: number | null;
  setCount: number;
}

export interface UpsertDailyInput {
  userId: string;
  date: string;
  workoutCount: number;
  totalVolumeKg: number;
  totalDurationSec: number;
  setCount: number;
}

export interface UpsertWeeklyInput {
  userId: string;
  weekStart: string;
  workoutCount: number;
  totalVolumeKg: number;
  totalDurationSec: number;
  trainingDays: number;
}

export interface UpsertMuscleVolumeInput {
  userId: string;
  muscleGroupId: string;
  date: string;
  volumeKg: number;
  setCount: number;
}

export interface UpsertExerciseStatInput {
  userId: string;
  exerciseId: string;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastVolumeKg: number | null;
  bestWeightKg: number | null;
  bestEstimated1rmKg: number | null;
  totalSessions: number;
  lastPerformedAt: Date | null;
}

/**
 * Port for analytics snapshots and recompute data access.
 */
export interface AnalyticsRepository {
  getUserTimezone(userId: string): Promise<string>;
  findCompletedWorkoutsAround(
    userId: string,
    fromUtc: Date,
    toUtc: Date,
  ): Promise<WorkoutAnalyticsSlice[]>;
  findExerciseMuscles(exerciseIds: string[]): Promise<ExerciseMuscleLink[]>;
  upsertDaily(input: UpsertDailyInput): Promise<void>;
  upsertWeekly(input: UpsertWeeklyInput): Promise<void>;
  replaceMuscleVolumeForDay(
    userId: string,
    date: string,
    rows: UpsertMuscleVolumeInput[],
  ): Promise<void>;
  upsertExerciseStat(input: UpsertExerciseStatInput): Promise<void>;
  getExerciseStat(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseStatRecord | null>;
  listDaily(
    userId: string,
    from: string,
    to: string,
  ): Promise<DailySnapshotRecord[]>;
  listWeekly(
    userId: string,
    fromWeekStart: string,
    toWeekStart: string,
  ): Promise<WeeklySnapshotRecord[]>;
  listMuscleVolume(
    userId: string,
    from: string,
    to: string,
  ): Promise<MuscleVolumeRecord[]>;
  listTrainedDateKeys(userId: string, timeZone: string): Promise<string[]>;
  countCompletedWorkouts(userId: string): Promise<number>;
  countSessionsForExercise(userId: string, exerciseId: string): Promise<number>;
  exerciseVolumeSeries(
    userId: string,
    exerciseId: string,
    fromUtc: Date,
    toUtc: Date,
    timeZone: string,
  ): Promise<ExerciseSeriesPoint[]>;
  listBodyWeightKg(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ recordedAt: Date; weightKg: number }>>;
}

