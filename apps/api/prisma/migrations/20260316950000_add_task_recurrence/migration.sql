-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "recurrence_rule" TEXT,
ADD COLUMN "recurrence_parent_id" TEXT,
ADD COLUMN "recurrence_last_created" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_recurrence_rule_idx" ON "tasks"("recurrence_rule");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;
