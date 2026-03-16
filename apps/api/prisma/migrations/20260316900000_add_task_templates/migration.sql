-- CreateTable
CREATE TABLE "task_templates" (
    "task_template_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "acceptance_criteria" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "task_type" TEXT NOT NULL DEFAULT 'task',
    "estimated_hours" DOUBLE PRECISION,
    "story_points" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("task_template_id")
);

-- CreateIndex
CREATE INDEX "task_templates_org_id_idx" ON "task_templates"("org_id");

-- CreateIndex
CREATE INDEX "task_templates_project_id_idx" ON "task_templates"("project_id");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE SET NULL ON UPDATE CASCADE;
