-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('STRENGTH', 'BODY_WEIGHT', 'FREQUENCY', 'VOLUME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "GoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "target_value" DECIMAL(12,2),
    "target_unit" TEXT,
    "exercise_id" UUID,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "target_date" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goals_user_id_deleted_at_idx" ON "goals"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
