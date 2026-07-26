-- CreateEnum
CREATE TYPE "PrType" AS ENUM ('MAX_WEIGHT', 'MAX_REPS', 'MAX_VOLUME', 'ESTIMATED_1RM');

-- CreateTable
CREATE TABLE "personal_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "type" "PrType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "workout_id" UUID,
    "achieved_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_records_user_id_exercise_id_achieved_at_idx" ON "personal_records"("user_id", "exercise_id", "achieved_at" DESC);

-- CreateIndex
CREATE INDEX "personal_records_user_id_type_achieved_at_idx" ON "personal_records"("user_id", "type", "achieved_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "personal_records_user_id_exercise_id_type_workout_id_key" ON "personal_records"("user_id", "exercise_id", "type", "workout_id");

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
