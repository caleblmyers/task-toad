-- CreateTable
CREATE TABLE "task_insights" (
    "task_insight_id" TEXT NOT NULL,
    "source_task_id" TEXT NOT NULL,
    "target_task_id" TEXT,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "auto_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_insights_pkey" PRIMARY KEY ("task_insight_id")
);

-- CreateIndex
CREATE INDEX "task_insights_source_task_id_idx" ON "task_insights"("source_task_id");

-- CreateIndex
CREATE INDEX "task_insights_target_task_id_idx" ON "task_insights"("target_task_id");

-- CreateIndex
CREATE INDEX "task_insights_project_id_idx" ON "task_insights"("project_id");

-- AddForeignKey
ALTER TABLE "task_insights" ADD CONSTRAINT "task_insights_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_insights" ADD CONSTRAINT "task_insights_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "tasks"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_insights" ADD CONSTRAINT "task_insights_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_insights" ADD CONSTRAINT "task_insights_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;
