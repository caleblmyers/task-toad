-- CreateTable
CREATE TABLE "ai_prompt_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "task_id" TEXT,
    "project_id" TEXT,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_prompt_logs_org_id_created_at_idx" ON "ai_prompt_logs"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_prompt_logs_task_id_idx" ON "ai_prompt_logs"("task_id");

-- CreateIndex
CREATE INDEX "ai_prompt_logs_project_id_created_at_idx" ON "ai_prompt_logs"("project_id", "created_at");
