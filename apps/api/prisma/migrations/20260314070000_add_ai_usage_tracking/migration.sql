-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_org_id_created_at_idx" ON "ai_usage_logs"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "orgs" ADD COLUMN "monthly_budget_cents_usd" INTEGER;
ALTER TABLE "orgs" ADD COLUMN "budget_alert_threshold" INTEGER NOT NULL DEFAULT 80;
