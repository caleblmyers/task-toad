-- AlterTable
ALTER TABLE "automation_rules" ADD COLUMN "cron_expression" TEXT,
ADD COLUMN "timezone" TEXT DEFAULT 'UTC',
ADD COLUMN "next_run_at" TIMESTAMP(3),
ADD COLUMN "last_run_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "automation_rules_next_run_at_idx" ON "automation_rules"("next_run_at");
