-- CreateTable
CREATE TABLE "releases" (
    "release_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "release_date" TEXT,
    "release_notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("release_id")
);

-- CreateTable
CREATE TABLE "release_tasks" (
    "release_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_tasks_pkey" PRIMARY KEY ("release_id","task_id")
);

-- CreateIndex
CREATE INDEX "releases_project_id_idx" ON "releases"("project_id");

-- CreateIndex
CREATE INDEX "releases_org_id_idx" ON "releases"("org_id");

-- CreateIndex
CREATE INDEX "releases_project_id_status_idx" ON "releases"("project_id", "status");

-- CreateIndex
CREATE INDEX "release_tasks_task_id_idx" ON "release_tasks"("task_id");

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("release_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;
