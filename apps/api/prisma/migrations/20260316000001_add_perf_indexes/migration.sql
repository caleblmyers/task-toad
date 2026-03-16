-- CreateIndex
CREATE INDEX "tasks_org_id_archived_idx" ON "tasks"("org_id", "archived");

-- CreateIndex
CREATE INDEX "activities_task_id_created_at_idx" ON "activities"("task_id", "created_at");
