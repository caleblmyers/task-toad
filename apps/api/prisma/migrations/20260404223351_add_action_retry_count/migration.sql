-- AlterTable
ALTER TABLE "task_actions" ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;
