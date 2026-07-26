import { PlannedWorkout } from '../planned-workout.entity';

export const CALENDAR_REPOSITORY = Symbol('CALENDAR_REPOSITORY');

export interface CreatePlannedWorkoutInput {
  userId: string;
  title?: string | null;
  plannedDate: string;
  notes?: string | null;
}

export interface UpdatePlannedWorkoutInput {
  title?: string | null;
  plannedDate?: string;
  notes?: string | null;
}

export interface CompletedCalendarItem {
  id: string;
  title: string | null;
  date: string;
  status: string;
  durationSec: number | null;
  startedAt: Date;
  completedAt: Date;
}

export interface CalendarRepository {
  getUserTimezone(userId: string): Promise<string>;
  listCompletedInRange(
    userId: string,
    fromUtc: Date,
    toUtc: Date,
    timeZone: string,
  ): Promise<CompletedCalendarItem[]>;
  listPlannedInRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<PlannedWorkout[]>;
  createPlanned(input: CreatePlannedWorkoutInput): Promise<PlannedWorkout>;
  findPlannedByIdForUser(
    id: string,
    userId: string,
  ): Promise<PlannedWorkout | null>;
  updatePlanned(
    id: string,
    userId: string,
    input: UpdatePlannedWorkoutInput,
  ): Promise<PlannedWorkout>;
  softDeletePlanned(id: string, userId: string): Promise<void>;
}
