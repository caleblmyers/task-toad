-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "due_date" TEXT,
ADD COLUMN     "position" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "tasks_project_id_sprint_id_position_idx" ON "tasks"("project_id", "sprint_id", "position");
