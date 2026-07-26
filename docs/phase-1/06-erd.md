# 06 — Entity Relationship Diagram

## Logical ERD (Mermaid)

```mermaid
erDiagram
  USER ||--o| USER_PROFILE : has
  USER ||--o{ REFRESH_TOKEN : issues
  USER ||--o{ WORKOUT : owns
  USER ||--o{ PERSONAL_RECORD : achieves
  USER ||--o{ BODY_WEIGHT_ENTRY : logs
  USER ||--o{ BODY_MEASUREMENT : logs
  USER ||--o{ GOAL : sets
  USER ||--o{ PLANNED_WORKOUT : plans
  USER ||--o{ NOTIFICATION : receives
  USER ||--o| NOTIFICATION_PREFERENCE : configures
  USER ||--o{ ANALYTICS_DAILY_SNAPSHOT : has
  USER ||--o{ ANALYTICS_WEEKLY_SNAPSHOT : has
  USER ||--o{ MUSCLE_VOLUME_DAILY : has
  USER ||--o{ EXERCISE_STAT : has
  USER ||--o{ AI_PARSE_LOG : generates
  USER ||--o{ AUDIT_LOG : acts

  WORKOUT ||--|{ WORKOUT_EXERCISE : contains
  WORKOUT_EXERCISE }o--|| EXERCISE : references
  WORKOUT_EXERCISE ||--|{ WORKOUT_SET : contains

  EXERCISE }o--o| EXERCISE_CATEGORY : in
  EXERCISE }o--o| EQUIPMENT : uses
  EXERCISE ||--o{ EXERCISE_ALIAS : named_as
  EXERCISE ||--o{ EXERCISE_MUSCLE : targets
  EXERCISE_MUSCLE }o--|| MUSCLE_GROUP : maps
  MUSCLE_GROUP ||--o{ MUSCLE_GROUP : parent_of

  PERSONAL_RECORD }o--|| EXERCISE : for
  EXERCISE_STAT }o--|| EXERCISE : for
  MUSCLE_VOLUME_DAILY }o--|| MUSCLE_GROUP : for

  USER {
    uuid id PK
    citext email UK
    string password_hash
    string google_sub UK
    enum role
    enum status
    timestamptz deleted_at
  }

  USER_PROFILE {
    uuid id PK
    uuid user_id FK
    date date_of_birth
    enum gender
    decimal height_value
    enum fitness_goal
    enum activity_level
    enum preferred_weight_unit
  }

  WORKOUT {
    uuid id PK
    uuid user_id FK
    enum source
    enum status
    timestamptz started_at
    timestamptz completed_at
    timestamptz deleted_at
  }

  WORKOUT_EXERCISE {
    uuid id PK
    uuid workout_id FK
    uuid exercise_id FK
    int position
  }

  WORKOUT_SET {
    uuid id PK
    uuid workout_exercise_id FK
    int set_number
    int reps
    decimal weight
    enum weight_unit
    decimal weight_kg
  }

  EXERCISE {
    uuid id PK
    string slug UK
    string name
    boolean is_custom
  }

  PERSONAL_RECORD {
    uuid id PK
    uuid user_id FK
    uuid exercise_id FK
    enum type
    decimal value
    timestamptz achieved_at
  }
```

## Relationship Cardinalities (Text)

| Parent | Child | Cardinality | On delete |
|--------|-------|-------------|-----------|
| User | Profile | 1:0..1 | CASCADE |
| User | Workouts | 1:N | CASCADE |
| Workout | WorkoutExercises | 1:N | CASCADE |
| WorkoutExercise | Sets | 1:N | CASCADE |
| Exercise | WorkoutExercises | 1:N | RESTRICT |
| Exercise | Muscles | 1:N | CASCADE |
| MuscleGroup | Self | 1:N tree | SET NULL |
| User | PRs | 1:N | CASCADE |
| User | Analytics snapshots | 1:N | CASCADE |

## Physical Notes

- All FKs indexed (Prisma does this for relation fields used in `@@index` where needed).
- Soft-deleted workouts remain for referential integrity of PRs that point at `workout_id` (nullable string without FK in PR table to avoid hard coupling — optional FK can be added without cascade).
- Catalog tables (`exercises`, `muscle_groups`) are rarely deleted; prefer `is_active` / `deleted_at`.
