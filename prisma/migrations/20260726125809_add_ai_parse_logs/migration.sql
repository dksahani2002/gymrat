-- CreateTable
CREATE TABLE "ai_parse_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "modality" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "input_hash" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "confidence" DECIMAL(4,3),
    "success" BOOLEAN NOT NULL,
    "error_code" TEXT,
    "result_summary" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_parse_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_parse_logs_user_id_created_at_idx" ON "ai_parse_logs"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "ai_parse_logs" ADD CONSTRAINT "ai_parse_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
