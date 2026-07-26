-- CreateTable
CREATE TABLE "planned_workouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "planned_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "planned_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planned_workouts_user_id_planned_date_idx" ON "planned_workouts"("user_id", "planned_date");

-- CreateIndex
CREATE INDEX "planned_workouts_user_id_deleted_at_idx" ON "planned_workouts"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
