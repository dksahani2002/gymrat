-- CreateTable
CREATE TABLE "body_weight_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "unit" "WeightUnit" NOT NULL DEFAULT 'KG',
    "weight_kg" DECIMAL(8,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "body_weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_weight_entries_user_id_recorded_at_idx" ON "body_weight_entries"("user_id", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "body_weight_entries_user_id_deleted_at_idx" ON "body_weight_entries"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "body_weight_entries" ADD CONSTRAINT "body_weight_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
