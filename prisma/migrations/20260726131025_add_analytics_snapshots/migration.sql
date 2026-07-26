-- CreateTable
CREATE TABLE "analytics_daily_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "workout_count" INTEGER NOT NULL DEFAULT 0,
    "total_volume_kg" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_duration_sec" INTEGER NOT NULL DEFAULT 0,
    "set_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_weekly_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "workout_count" INTEGER NOT NULL DEFAULT 0,
    "total_volume_kg" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_duration_sec" INTEGER NOT NULL DEFAULT 0,
    "training_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_weekly_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_volume_daily" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "muscle_group_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "volume_kg" DECIMAL(14,2) NOT NULL,
    "set_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "muscle_volume_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "last_weight_kg" DECIMAL(8,2),
    "last_reps" INTEGER,
    "last_volume_kg" DECIMAL(14,2),
    "best_weight_kg" DECIMAL(8,2),
    "best_estimated_1rm_kg" DECIMAL(8,2),
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "last_performed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exercise_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_daily_snapshots_user_id_date_idx" ON "analytics_daily_snapshots"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_snapshots_user_id_date_key" ON "analytics_daily_snapshots"("user_id", "date");

-- CreateIndex
CREATE INDEX "analytics_weekly_snapshots_user_id_week_start_idx" ON "analytics_weekly_snapshots"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_weekly_snapshots_user_id_week_start_key" ON "analytics_weekly_snapshots"("user_id", "week_start");

-- CreateIndex
CREATE INDEX "muscle_volume_daily_user_id_date_idx" ON "muscle_volume_daily"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "muscle_volume_daily_user_id_muscle_group_id_date_key" ON "muscle_volume_daily"("user_id", "muscle_group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_stats_user_id_exercise_id_key" ON "exercise_stats"("user_id", "exercise_id");

-- AddForeignKey
ALTER TABLE "analytics_daily_snapshots" ADD CONSTRAINT "analytics_daily_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_weekly_snapshots" ADD CONSTRAINT "analytics_weekly_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muscle_volume_daily" ADD CONSTRAINT "muscle_volume_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muscle_volume_daily" ADD CONSTRAINT "muscle_volume_daily_muscle_group_id_fkey" FOREIGN KEY ("muscle_group_id") REFERENCES "muscle_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_stats" ADD CONSTRAINT "exercise_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_stats" ADD CONSTRAINT "exercise_stats_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
