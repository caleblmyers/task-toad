-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "description" TEXT,
ADD COLUMN     "prompt" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "description" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "parent_task_id" TEXT,
ADD COLUMN     "suggested_tools" TEXT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;
