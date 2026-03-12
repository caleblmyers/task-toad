-- AlterTable
ALTER TABLE "sprints" ADD COLUMN     "closed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;
