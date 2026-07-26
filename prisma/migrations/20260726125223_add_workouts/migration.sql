-- CreateEnum
CREATE TYPE "WorkoutSource" AS ENUM ('MANUAL', 'AI_TEXT', 'AI_VOICE', 'AI_OCR', 'IMPORT');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "source" "WorkoutSource" NOT NULL DEFAULT 'MANUAL',
    "status" "WorkoutStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "duration_sec" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "workout_exercise_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" DECIMAL(8,2),
    "weight_unit" "WeightUnit" NOT NULL DEFAULT 'KG',
    "weight_kg" DECIMAL(8,2),
    "rpe" DECIMAL(3,1),
    "duration_sec" INTEGER,
    "distance_m" DECIMAL(10,2),
    "is_warmup" BOOLEAN NOT NULL DEFAULT false,
    "is_failure" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "workout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workout_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workouts_user_id_completed_at_idx" ON "workouts"("user_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "workouts_user_id_started_at_idx" ON "workouts"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "workouts_user_id_deleted_at_idx" ON "workouts"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "workout_exercises_workout_id_idx" ON "workout_exercises"("workout_id");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_exercises_workout_id_position_key" ON "workout_exercises"("workout_id", "position");

-- CreateIndex
CREATE INDEX "workout_sets_workout_exercise_id_idx" ON "workout_sets"("workout_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_workout_exercise_id_set_number_key" ON "workout_sets"("workout_exercise_id", "set_number");

-- CreateIndex
CREATE INDEX "workout_idempotency_keys_expires_at_idx" ON "workout_idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "workout_idempotency_keys_user_id_key_key" ON "workout_idempotency_keys"("user_id", "key");

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
